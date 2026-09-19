//! Download executor with reqwest streaming, Range requests, and SHA-1/SHA-256 verification.
//!
//! Spec format: `{ "url": "https://..." }`.
//!
//! The implementation composes `AsyncRead` types. `DownloadReader`, the `AsyncRead` implementation
//! in this module, wraps tokio-util's `StreamReader` and handles:
//!   - cancellation by checking `run_token` during polling and returning `Interrupted`;
//!   - throttled progress reports through `try_send`, which may drop an update before the next window;
//!   - optional rate limiting through `TokenBucket`, whose delay drives a Sleep.
//!
//! `run_inner` only orchestrates the request, copy, verification, and rename steps.
//!
//! Behavior:
//! - Write to `<dest>.part`, then rename it to `dest` after successful verification.
//! - Send `Range: bytes=offset-` when `resume_offset > 0`; restart if Range is unsupported.
//! - Use the `.part` file size as the resume offset, so no separate persistence is needed.
//! - Report `Interrupted { offset }` on interruption; the actor decides whether to retain `.part`.

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
  /// Progress reporting interval.
  pub report_interval: Duration,
  /// Rate limiter shared by the executor instance, or None for unlimited throughput.
  pub limiter: Option<Arc<TokenBucket>>,
  /// Host-provided request customization for injecting authentication by URL without persisting
  /// credentials in task specs.
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
    // The `.part` file size is the authoritative resume offset. After a crash, the database offset
    // may be stale because no Interrupted report was sent, while `.part` retains all progress.
    // Normal pause, cancellation, and verification-failure paths persist the offset or remove
    // `.part` as appropriate.
    let resume = match tokio::fs::metadata(&part_path).await {
      Ok(m) if m.len() > 0 => m.len(),
      _ => 0,
    };

    // 1. Send the request, cancellable through run_token.
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
      // Clear an invalid or oversized local checkpoint so the automatic retry starts over.
      let _ = tokio::fs::remove_file(&part_path).await;
      return Err(TaskError::Network("服务器拒绝断点位置，将从头重试".into()));
    }
    let is_range = status == reqwest::StatusCode::PARTIAL_CONTENT;
    if !status.is_success() {
      return Err(TaskError::Http(status.as_u16()));
    }
    // A 200 response to a Range request means the server requires a full restart.
    let offset = if resume > 0 && !is_range { 0 } else { resume };
    let total = if is_range {
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

    // 2. Build the bytes_stream -> DownloadReader pipeline for cancellation, progress, and limits.
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

    // 3. Copy the response; cancellation makes the reader return Interrupted.
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

    // 4. Report final progress, verify content, and rename the file.
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

/// Wraps a `StreamReader` with cancellation, progress reporting, and rate limiting.
pub struct DownloadReader<R> {
  inner: R,
  task_id: String,
  token: tokio_util::sync::CancellationToken,
  report: Option<tokio::sync::mpsc::Sender<TaskReport>>,
  report_interval: Duration,
  limiter: Option<Arc<TokenBucket>>,
  /// Bytes yielded, including the resume offset.
  received: u64,
  total: u64,
  last_report: Instant,
  /// Sleep for the current rate-limit delay.
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
      // Subtract one interval so the first chunk is reported immediately.
      last_report: Instant::now() - report_interval,
      wait: None,
    }
  }

  /// Bytes consumed, reported as the offset on interruption.
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
    // 1. Return Interrupted on cancellation so the copy stops naturally.
    if self.token.is_cancelled() {
      return Poll::Ready(Err(io::Error::new(io::ErrorKind::Interrupted, "cancelled")));
    }
    // 2. Poll the rate-limit Sleep.
    if let Some(wait) = self.wait.as_mut() {
      match Future::poll(wait.as_mut(), cx) {
        Poll::Pending => return Poll::Pending,
        Poll::Ready(_) => self.wait = None,
      }
    }
    // 3. Read from the inner reader.
    match Pin::new(&mut self.inner).poll_read(cx, buf) {
      Poll::Pending => Poll::Pending,
      Poll::Ready(Err(e)) => Poll::Ready(Err(e)),
      Poll::Ready(Ok(())) => {
        let n = buf.filled().len() as u64;
        if n > 0 {
          self.received += n;
          // 4. Send a throttled progress update; try_send may defer it to the next window.
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
          // 5. Account for rate limiting and set the delay before the next poll.
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

/// Parses the start and total length from `Content-Range: bytes start-end/total`.
fn content_range(v: Option<&reqwest::header::HeaderValue>) -> Option<(u64, u64)> {
  let value = v?.to_str().ok()?.strip_prefix("bytes ")?;
  let (range, total) = value.split_once('/')?;
  let (start, _end) = range.split_once('-')?;
  Some((start.parse().ok()?, total.parse().ok()?))
}

/// Parses `Content-Range: bytes */total` from a 416 response.
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

/// Computes lowercase hexadecimal SHA-1 and SHA-256 digests in a single read.
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
