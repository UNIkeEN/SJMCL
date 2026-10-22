//! Download executor: streaming reqwest transfers, Range resumption,
//! and SHA-1/SHA-256 verification.
//!
//! Task spec format: { "url": "https://...", "fallbackUrls": ["https://..."] }.
//! fallbackUrls is optional. The actor cycles through sources with backoff after
//! network, HTTP, or checksum failures, persisting the current source order.
//!
//! The transfer is composed as AsyncRead layers.
//! DownloadReader wraps tokio-util's StreamReader and owns:
//! cancellation, progress reporting, and optional rate limiting.
//! - Cancellation checks run_token in poll_read and interrupts the copy.
//! - Progress uses throttled try_send; a later report replaces a dropped one.
//! - Rate limiting schedules a Sleep after TokenBucket::consume(n).
//!
//! run_inner orchestrates the request, copy, verification, and rename.
//!
//! Transfer behavior:
//! - Write to `<dest>.part` and rename it after successful verification.
//! - Try HEAD to resolve redirects before resuming a nonempty partial file.
//! - Request Range when the partial file is nonempty; fall back to a full GET if unsupported.
//! - Use the partial file size as the resume offset, including after a crash.
//! - Report Interrupted with the written offset; the actor decides whether to keep the file.

use std::io;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

use futures_util::{Stream, StreamExt};
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::future::Future;
use tokio::io::{AsyncRead, AsyncWriteExt, ReadBuf};
use tokio_util::io::StreamReader;

use crate::executor::{BoxFuture, TaskExecutor};
use crate::rate::TokenBucket;
use crate::{ExecContext, TaskError, TaskOutcome, TaskReport};

pub type RequestDecorator =
  Arc<dyn Fn(&str, reqwest::RequestBuilder) -> reqwest::RequestBuilder + Send + Sync>;

pub struct DownloadExecutor {
  pub client: reqwest::Client,
  /// Minimum interval between worker progress reports.
  pub report_interval: Duration,
  /// Limiter shared by this executor instance; None means unlimited transfer speed.
  pub limiter: Option<Arc<TokenBucket>>,
  /// Let the host add authentication headers per URL without persisting credentials in task specs.
  pub request_decorator: Option<RequestDecorator>,
}

impl Default for DownloadExecutor {
  fn default() -> Self {
    DownloadExecutor {
      client: reqwest::Client::new(),
      report_interval: Duration::from_millis(100),
      limiter: None,
      request_decorator: None,
    }
  }
}

impl Clone for DownloadExecutor {
  fn clone(&self) -> Self {
    DownloadExecutor {
      client: self.client.clone(),
      report_interval: self.report_interval,
      limiter: self.limiter.clone(),
      request_decorator: self.request_decorator.clone(),
    }
  }
}

impl TaskExecutor for DownloadExecutor {
  fn name(&self) -> &'static str {
    "download"
  }

  fn run(&self, ctx: ExecContext) -> BoxFuture<'static, Result<(), TaskError>> {
    let this = self.clone();
    Box::pin(async move { this.run_inner(ctx).await })
  }
}

impl DownloadExecutor {
  async fn run_inner(&self, ctx: ExecContext) -> Result<(), TaskError> {
    let mut url = ctx
      .spec
      .get("url")
      .and_then(|v| v.as_str())
      .ok_or_else(|| TaskError::MissingField {
        field: "url".into(),
      })?
      .to_string();
    let dest = ctx.dest.clone().ok_or_else(|| TaskError::MissingField {
      field: "dest".into(),
    })?;
    if let Some(parent) = dest.parent().filter(|p| !p.as_os_str().is_empty()) {
      tokio::fs::create_dir_all(parent).await?;
    }
    let part_path = part_path(&dest);
    // The partial file size is authoritative for resumption.
    // After a crash, the database offset can lag because no Interrupted report was sent,
    // while the partial file still contains the downloaded bytes.
    let mut resume = match tokio::fs::metadata(&part_path).await {
      Ok(m) if m.len() > 0 => m.len(),
      _ => 0,
    };

    let mut request_offset = resume;
    let mut resolve_resume_redirect = resume > 0;
    loop {
      // Rebuild requests so authentication and cancellation also apply to redirects and fallbacks.
      let req = if resolve_resume_redirect {
        self.client.head(&url)
      } else {
        self.client.get(&url)
      }
      .header("Accept-Encoding", "identity");
      let req = if request_offset > 0 && !resolve_resume_redirect {
        req.header("Range", format!("bytes={request_offset}-"))
      } else {
        req
      };
      let req = if let Some(decorate) = &self.request_decorator {
        decorate(&url, req)
      } else {
        req
      };
      let resp = tokio::select! {
        r = req.send() => match r {
            Ok(r) => r,
            Err(_) if resolve_resume_redirect => {
              resolve_resume_redirect = false;
              continue;
            }
            Err(_) if request_offset > 0 => {
              request_offset = 0;
              continue;
            }
            Err(e) => return Err(TaskError::Network { details: e.to_string() }),
        },
        _ = ctx.run_token.cancelled() => {
            // The old partial file is retained until a usable response is received.
            report_interrupted(&ctx, resume).await;
            return Ok(());
        }
      };

      let status = resp.status();
      if resolve_resume_redirect {
        resolve_resume_redirect = false;
        if status.is_success() {
          url = resp.url().to_string();
        }
        // HEAD is best-effort; unsupported servers may still accept a Range GET.
        continue;
      }
      // A 416 whose total matches the partial file means all bytes are already present.
      if status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE
        && request_offset > 0
        && content_range_unsatisfied_total(resp.headers().get("content-range"))
          == Some(request_offset)
      {
        let _ = ctx
          .report
          .send(TaskReport::Progress {
            task_id: ctx.task_id.clone(),
            received: request_offset,
            total: request_offset,
          })
          .await;
        return finalize_download(&ctx, &part_path, &dest).await;
      }

      let (offset, total) = if status == reqwest::StatusCode::PARTIAL_CONTENT {
        // Only append a 206 whose range starts exactly at the requested offset.
        match content_range(resp.headers().get("content-range")) {
          Some((start, total)) if start == request_offset => (request_offset, total),
          Some((start, _)) if request_offset == 0 => {
            return Err(TaskError::ResumeOffsetMismatch {
              expected: request_offset,
              actual: start,
            });
          }
          None if request_offset == 0 => return Err(TaskError::InvalidContentRange),
          _ => {
            request_offset = 0;
            continue;
          }
        }
      } else if status.is_success() {
        // A full response to a Range request can be used immediately, overwriting the part file.
        let total = resp
          .content_length()
          .or_else(|| ctx.spec.get("size").and_then(|size| size.as_u64()))
          .unwrap_or(0);
        (0, total)
      } else if request_offset == 0 {
        return Err(TaskError::Http {
          status: status.as_u16(),
        });
      } else {
        // Any rejected Range may still allow a full GET, regardless of its status code.
        // Retry once within this attempt, preserving the normal retry budget.
        request_offset = 0;
        continue;
      };

      // Wrap the response stream with cancellation, progress, and rate limiting.
      let stream: Pin<Box<dyn Stream<Item = Result<bytes::Bytes, io::Error>> + Send>> =
        Box::pin(resp.bytes_stream().map(|r| r.map_err(io::Error::other)));
      let inner = StreamReader::new(stream);
      let mut reader = DownloadReader::new(
        inner,
        ctx.task_id.clone(),
        ctx.run_token.clone(),
        Some(ctx.report.clone()),
        self.report_interval,
        offset,
        total,
        self.limiter.clone(),
      );

      let mut file = if offset > 0 {
        tokio::fs::OpenOptions::new()
          .append(true)
          .create(true)
          .open(&part_path)
          .await?
      } else {
        tokio::fs::File::create(&part_path).await?
      };

      // Copy into the partial file; an Interrupted reader stops the copy.
      match tokio::io::copy(&mut reader, &mut file).await {
        Ok(_) => {}
        Err(e) if e.kind() == io::ErrorKind::Interrupted => {
          let _ = file.flush().await;
          report_interrupted(&ctx, reader.offset()).await;
          return Ok(());
        }
        Err(e) => {
          file.flush().await?;
          if e
            .get_ref()
            .and_then(|source| source.downcast_ref::<reqwest::Error>())
            .is_some()
          {
            if offset > 0 {
              // A broken partial response also gets one full-download fallback.
              resume = reader.offset();
              request_offset = 0;
              continue;
            }
            return Err(TaskError::Network {
              details: e.to_string(),
            });
          }
          return Err(e.into());
        }
      }
      file.flush().await?;
      drop(file);

      // Report final progress, verify the content, and rename the file.
      let _ = ctx
        .report
        .send(TaskReport::Progress {
          task_id: ctx.task_id.clone(),
          received: reader.offset(),
          // At EOF the actual size is known, even for chunked responses or stale size hints.
          total: reader.offset(),
        })
        .await;
      return finalize_download(&ctx, &part_path, &dest).await;
    }
  }
}

/// AsyncRead wrapper for cancellation, progress reporting, and rate limiting.
pub struct DownloadReader<R> {
  inner: R,
  task_id: String,
  token: tokio_util::sync::CancellationToken,
  report: Option<tokio::sync::mpsc::Sender<TaskReport>>,
  report_interval: Duration,
  limiter: Option<Arc<TokenBucket>>,
  /// Bytes yielded by this reader, including the resumed portion.
  received: u64,
  total: u64,
  last_report: Instant,
  /// Sleep used to delay the next poll when rate limited.
  wait: Option<Pin<Box<tokio::time::Sleep>>>,
}

impl<R> DownloadReader<R> {
  #[allow(clippy::too_many_arguments)]
  pub fn new(
    inner: R,
    task_id: String,
    token: tokio_util::sync::CancellationToken,
    report: Option<tokio::sync::mpsc::Sender<TaskReport>>,
    report_interval: Duration,
    offset: u64,
    total: u64,
    limiter: Option<Arc<TokenBucket>>,
  ) -> Self {
    DownloadReader {
      inner,
      task_id,
      token,
      report,
      report_interval,
      limiter,
      received: offset,
      total,
      // Report the first chunk immediately.
      last_report: Instant::now() - report_interval,
      wait: None,
    }
  }

  /// Bytes consumed by this reader; reported as the offset on interruption.
  pub fn offset(&self) -> u64 {
    self.received
  }
}

impl<R: AsyncRead + Unpin> AsyncRead for DownloadReader<R> {
  fn poll_read(
    mut self: Pin<&mut Self>,
    cx: &mut Context<'_>,
    buf: &mut ReadBuf<'_>,
  ) -> Poll<io::Result<()>> {
    // Cancellation interrupts the copy through an I/O error.
    if self.token.is_cancelled() {
      return Poll::Ready(Err(io::Error::new(io::ErrorKind::Interrupted, "cancelled")));
    }
    // Poll any pending rate-limit delay before reading again.
    if let Some(wait) = self.wait.as_mut() {
      match Future::poll(wait.as_mut(), cx) {
        Poll::Pending => return Poll::Pending,
        Poll::Ready(_) => self.wait = None,
      }
    }
    // Read the underlying stream.
    let filled_before = buf.filled().len();
    match Pin::new(&mut self.inner).poll_read(cx, buf) {
      Poll::Pending => Poll::Pending,
      Poll::Ready(Err(e)) => Poll::Ready(Err(e)),
      Poll::Ready(Ok(())) => {
        // Copy may top up a nonempty buffer while waiting for the writer.
        let n = (buf.filled().len() - filled_before) as u64;
        if n > 0 {
          self.received += n;
          // Throttle progress reports; a later report can replace a dropped try_send.
          let now = Instant::now();
          if now.duration_since(self.last_report) >= self.report_interval {
            self.last_report = now;
            if let Some(tx) = &self.report {
              let _ = tx.try_send(TaskReport::Progress {
                task_id: self.task_id.clone(),
                received: self.received,
                total: self.total,
              });
            }
          }
          // Account for rate usage and delay the next read if needed.
          if let Some(lim) = &self.limiter {
            let wait = lim.consume(n);
            if wait > Duration::ZERO {
              self.wait = Some(Box::pin(tokio::time::sleep(wait)));
            }
          }
        }
        Poll::Ready(Ok(()))
      }
    }
  }
}

fn part_path(dest: &Path) -> PathBuf {
  let mut s = dest.as_os_str().to_owned();
  s.push(".part");
  PathBuf::from(s)
}

/// Parse the start and total from Content-Range: bytes start-end/total.
fn content_range(v: Option<&reqwest::header::HeaderValue>) -> Option<(u64, u64)> {
  let value = v?.to_str().ok()?.strip_prefix("bytes ")?;
  let (range, total) = value.split_once('/')?;
  let (start, _end) = range.split_once('-')?;
  Some((start.parse().ok()?, total.parse().ok()?))
}

/// Parse Content-Range: bytes */total from a 416 response.
fn content_range_unsatisfied_total(v: Option<&reqwest::header::HeaderValue>) -> Option<u64> {
  v?.to_str().ok()?.strip_prefix("bytes */")?.parse().ok()
}

async fn report_interrupted(ctx: &ExecContext, offset: u64) {
  let _ = ctx
    .report
    .send(TaskReport::Outcome {
      task_id: ctx.task_id.clone(),
      outcome: TaskOutcome::Interrupted { offset },
    })
    .await;
}

async fn finalize_download(
  ctx: &ExecContext,
  part_path: &Path,
  dest: &Path,
) -> Result<(), TaskError> {
  if report_if_cancelled(ctx, part_path).await {
    return Ok(());
  }
  let has_checksum = ctx.sha1.is_some() || ctx.sha256.is_some();
  if has_checksum {
    let _ = ctx
      .report
      .send(TaskReport::Verifying {
        task_id: ctx.task_id.clone(),
      })
      .await;
    let (actual_sha1, actual_sha256) = tokio::select! {
      result = hash_file(part_path) => result?,
      _ = ctx.run_token.cancelled() => {
        report_if_cancelled(ctx, part_path).await;
        return Ok(());
      }
    };
    if report_if_cancelled(ctx, part_path).await {
      return Ok(());
    }
    let mismatch = ctx
      .sha1
      .as_ref()
      .filter(|expected| !actual_sha1.eq_ignore_ascii_case(expected))
      .map(|expected| (expected.clone(), actual_sha1))
      .or_else(|| {
        ctx
          .sha256
          .as_ref()
          .filter(|expected| !actual_sha256.eq_ignore_ascii_case(expected))
          .map(|expected| (expected.clone(), actual_sha256))
      });
    if let Some((expected, actual)) = mismatch {
      let _ = tokio::fs::remove_file(part_path).await;
      let _ = ctx
        .report
        .send(TaskReport::Outcome {
          task_id: ctx.task_id.clone(),
          outcome: TaskOutcome::ChecksumFailed { expected, actual },
        })
        .await;
      return Ok(());
    }
  }
  if let Err(error) = tokio::fs::rename(part_path, dest).await {
    if dest.exists() {
      tokio::fs::remove_file(dest).await?;
      tokio::fs::rename(part_path, dest).await?;
    } else {
      return Err(error.into());
    }
  }
  let _ = ctx
    .report
    .send(TaskReport::Outcome {
      task_id: ctx.task_id.clone(),
      outcome: TaskOutcome::Done {
        verified: has_checksum,
      },
    })
    .await;
  Ok(())
}

async fn report_if_cancelled(ctx: &ExecContext, part_path: &Path) -> bool {
  if !ctx.run_token.is_cancelled() {
    return false;
  }
  let offset = tokio::fs::metadata(part_path)
    .await
    .map(|metadata| metadata.len())
    .unwrap_or_default();
  report_interrupted(ctx, offset).await;
  true
}

/// Compute lowercase SHA-1 and SHA-256 hex digests in one read.
async fn hash_file(path: &Path) -> Result<(String, String), std::io::Error> {
  use tokio::io::AsyncReadExt;
  let mut file = tokio::fs::File::open(path).await?;
  let mut sha1 = Sha1::new();
  let mut sha256 = Sha256::new();
  let mut buf = vec![0u8; 64 * 1024];
  loop {
    let n = file.read(&mut buf).await?;
    if n == 0 {
      break;
    }
    sha1.update(&buf[..n]);
    sha256.update(&buf[..n]);
  }
  Ok((
    hex::encode(&sha1.finalize()),
    hex::encode(&sha256.finalize()),
  ))
}

mod hex {
  pub fn encode(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
      s.push_str(&format!("{b:02x}"));
    }
    s
  }
}
