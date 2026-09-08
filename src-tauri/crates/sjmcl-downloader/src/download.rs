//! download executor：reqwest 流式下载 + Range 断点续传 + SHA-1/SHA-256 校验。
//!
//! spec 格式：`{ "url": "https://..." }`
//!
//! 实现形态：**AsyncRead 组合**。
//! `DownloadReader`（本文件的 AsyncRead 实现）包在 tokio-util 的
//! `StreamReader` 外面，职责全部内聚在 reader 里：
//!   - 取消：poll 时检查 run_token → 返回 `Interrupted` 错误，copy 自然中断
//!   - 进度：节流后 `try_send` 回报（可丢，下一个窗口再补）
//!   - 限速：可选 TokenBucket，`consume(n)` 返回等待时长，挂 Sleep 驱动
//!
//! `run_inner` 退化为编排：握手 → copy → 校验 → rename。
//!
//! 行为约定：
//! - 写 `<dest>.part`，校验通过后 rename 为 dest
//! - resume_offset > 0 时带 `Range: bytes=offset-`；服务端不支持 Range 则重头下
//! - .part 文件大小即断点 offset（resume 时 stat），无需额外持久化
//! - 中断时回报 `Interrupted { offset }`；.part 去留由 actor 按原因决定

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
  /// 进度回报节流。
  pub report_interval: Duration,
  /// 限速器（同一 executor 实例内共享，即全局生效；None = 不限速）。
  pub limiter: Option<Arc<TokenBucket>>,
  /// 由嵌入方按 URL 注入认证头等请求信息，避免把凭据写入持久化任务 spec。
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
    // 实际续传点 = .part 文件大小（权威）。
    // 崩溃场景：DB offset 未及时落库（无 Interrupted 回报），但 .part 保留了全部进度；
    // 正常暂停/取消/校验失败路径分别由 offset 落库 / 删 .part 保证一致性。
    let resume = match tokio::fs::metadata(&part_path).await {
      Ok(m) if m.len() > 0 => m.len(),
      _ => 0,
    };

    // 1. 握手（可被 run_token 中断）
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
      // 本地断点比远端对象大或响应无效：清掉断点，自动重试时从头下载。
      let _ = tokio::fs::remove_file(&part_path).await;
      return Err(TaskError::Network("服务器拒绝断点位置，将从头重试".into()));
    }
    let is_range = status == reqwest::StatusCode::PARTIAL_CONTENT;
    if !status.is_success() {
      return Err(TaskError::Http(status.as_u16()));
    }
    // 续传协商：请求了 Range 但服务端回 200 → 重头下
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

    // 2. 构建读取管线：bytes_stream → DownloadReader（取消/进度/限速内聚）
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

    // 3. 拷贝（取消 = reader 返回 Interrupted）
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

    // 4. 终报进度 + 内容校验 + rename
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

/// 下载读取器：把 `AsyncRead`（StreamReader）包成带取消/进度/限速的 AsyncRead。
pub struct DownloadReader<R> {
  inner: R,
  task_id: String,
  token: tokio_util::sync::CancellationToken,
  report: Option<tokio::sync::mpsc::Sender<TaskReport>>,
  report_interval: Duration,
  limiter: Option<Arc<TokenBucket>>,
  /// 已 yield 字节（含续传起点）。
  received: u64,
  total: u64,
  last_report: Instant,
  /// 限流等待中的 Sleep。
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
      // 减去一个间隔：保证首个 chunk 立即上报
      last_report: Instant::now() - report_interval,
      wait: None,
    }
  }

  /// 已消费字节（中断时作为 offset 回报）。
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
    // 1. 取消：返回 Interrupted，让 copy 自然中断
    if self.token.is_cancelled() {
      return Poll::Ready(Err(io::Error::new(io::ErrorKind::Interrupted, "cancelled")));
    }
    // 2. 限流等待（poll 式 Sleep）
    if let Some(wait) = self.wait.as_mut() {
      match Future::poll(wait.as_mut(), cx) {
        Poll::Pending => return Poll::Pending,
        Poll::Ready(_) => self.wait = None,
      }
    }
    // 3. 读 inner
    match Pin::new(&mut self.inner).poll_read(cx, buf) {
      Poll::Pending => Poll::Pending,
      Poll::Ready(Err(e)) => Poll::Ready(Err(e)),
      Poll::Ready(Ok(())) => {
        let n = buf.filled().len() as u64;
        if n > 0 {
          self.received += n;
          // 4. 进度节流上报（try_send 可丢，下一个窗口补）
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
          // 5. 限速记账（返回前设置等待，下一 poll 阻塞）
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

/// 解析 `Content-Range: bytes start-end/total` 的起点和总长度。
fn content_range(v: Option<&reqwest::header::HeaderValue>) -> Option<(u64, u64)> {
  let value = v?.to_str().ok()?.strip_prefix("bytes ")?;
  let (range, total) = value.split_once('/')?;
  let (start, _end) = range.split_once('-')?;
  Some((start.parse().ok()?, total.parse().ok()?))
}

/// 解析 416 响应中的 `Content-Range: bytes */total`。
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

/// 单次读取同时计算 SHA-1 与 SHA-256（hex 小写）。
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
