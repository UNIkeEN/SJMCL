//! Download executor: streaming reqwest transfers, Range resumption,
//! and SHA-1/SHA-256 verification.
//!
//! Task spec format: { "url": "https://..." }.
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
//! - Request Range when the partial file is nonempty; restart if the server returns 200.
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
    let url = ctx
      .spec
      .get("url")
      .and_then(|v| v.as_str())
      .ok_or_else(|| TaskError::Other("spec 缺少 url".into()))?
      .to_string();
    let dest = ctx
      .dest
      .clone()
      .ok_or_else(|| TaskError::Other("缺少 dest".into()))?;
    if let Some(parent) = dest.parent().filter(|p| !p.as_os_str().is_empty()) {
      tokio::fs::create_dir_all(parent)
        .await
        .map_err(|e| TaskError::Io(e.to_string()))?;
    }
    let part_path = part_path(&dest);
    // The partial file size is authoritative for resumption.
    // After a crash, the database offset can lag because no Interrupted report was sent,
    // while the partial file still contains the downloaded bytes.
    let resume = match tokio::fs::metadata(&part_path).await {
      Ok(m) if m.len() > 0 => m.len(),
      _ => 0,
    };

    // Send the request, allowing run_token to interrupt the handshake.
    let req = self.client.get(&url).header("Accept-Encoding", "identity");
    let req = if resume > 0 {
      req.header("Range", format!("bytes={resume}-"))
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
            Err(e) => return Err(TaskError::Network(e.to_string())),
        },
        _ = ctx.run_token.cancelled() => {
            report_interrupted(&ctx, resume).await;
            return Ok(());
        }
    };

    let status = resp.status();
    if status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE && resume > 0 {
      // A 416 whose total matches the partial file means all bytes are already present.
      if content_range_unsatisfied_total(resp.headers().get("content-range")) == Some(resume) {
        let _ = ctx
          .report
          .send(TaskReport::Progress {
            task_id: ctx.task_id.clone(),
            received: resume,
            total: resume,
          })
          .await;
        return finalize_download(&ctx, &part_path, &dest).await;
      }
      // The local offset exceeds the remote object or the response is invalid; retry from zero.
      let _ = tokio::fs::remove_file(&part_path).await;
      return Err(TaskError::Network("服务器拒绝断点位置，将从头重试".into()));
    }
    let is_range = status == reqwest::StatusCode::PARTIAL_CONTENT;
    if !status.is_success() {
      return Err(TaskError::Http(status.as_u16()));
    }
    // A full 200 response to a Range request means the server ignored resumption.
    let offset = if resume > 0 && !is_range { 0 } else { resume };
    let total = if is_range {
      // A 206 must start exactly where the local partial file ends.
      let Some((start, total)) = content_range(resp.headers().get("content-range")) else {
        let _ = tokio::fs::remove_file(&part_path).await;
        return Err(TaskError::Network(
          "服务器返回了无效的 Content-Range，将从头重试".into(),
        ));
      };
      if start != resume {
        let _ = tokio::fs::remove_file(&part_path).await;
        return Err(TaskError::Network(format!(
          "服务器断点位置不匹配: 请求 {resume}，响应 {start}，将从头重试"
        )));
      }
      total
    } else {
      resp.content_length().unwrap_or(0)
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
        .await
        .map_err(|e| TaskError::Io(e.to_string()))?
    } else {
      tokio::fs::File::create(&part_path)
        .await
        .map_err(|e| TaskError::Io(e.to_string()))?
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
        if e
          .get_ref()
          .and_then(|source| source.downcast_ref::<reqwest::Error>())
          .is_some()
        {
          return Err(TaskError::Network(e.to_string()));
        }
        return Err(TaskError::Io(e.to_string()));
      }
    }
    file
      .flush()
      .await
      .map_err(|e| TaskError::Io(e.to_string()))?;

    // Report final progress, verify the content, and rename the file.
    let _ = ctx
      .report
      .send(TaskReport::Progress {
        task_id: ctx.task_id.clone(),
        received: reader.offset(),
        total,
      })
      .await;
    finalize_download(&ctx, &part_path, &dest).await
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
    match Pin::new(&mut self.inner).poll_read(cx, buf) {
      Poll::Pending => Poll::Pending,
      Poll::Ready(Err(e)) => Poll::Ready(Err(e)),
      Poll::Ready(Ok(())) => {
        let n = buf.filled().len() as u64;
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
      result = hash_file(part_path) => result.map_err(|e| TaskError::Io(e.to_string()))?,
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
      tokio::fs::remove_file(dest)
        .await
        .map_err(|e| TaskError::Io(e.to_string()))?;
      tokio::fs::rename(part_path, dest)
        .await
        .map_err(|e| TaskError::Io(e.to_string()))?;
    } else {
      return Err(TaskError::Io(error.to_string()));
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

#[cfg(test)]
mod tests {
  use super::{content_range, content_range_unsatisfied_total};
  use reqwest::header::HeaderValue;

  #[test]
  fn parses_content_ranges() {
    let partial = HeaderValue::from_static("bytes 100-199/1000");
    assert_eq!(content_range(Some(&partial)), Some((100, 1000)));
    let complete = HeaderValue::from_static("bytes */1000");
    assert_eq!(content_range_unsatisfied_total(Some(&complete)), Some(1000));
  }

  #[test]
  fn rejects_malformed_content_ranges() {
    let malformed = HeaderValue::from_static("items 100-199/1000");
    assert_eq!(content_range(Some(&malformed)), None);
    assert_eq!(content_range_unsatisfied_total(Some(&malformed)), None);
  }
}
