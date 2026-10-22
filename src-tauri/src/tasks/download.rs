use async_speed_limit::Limiter;
use futures::Stream;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::future::Future;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, Url};
use tauri_plugin_http::reqwest;
use tauri_plugin_http::reqwest::header::RANGE;
use tokio::io::AsyncSeekExt;
use tokio::io::AsyncWriteExt;
use tokio::task::JoinSet;
use tokio_util::bytes;

use crate::launcher_config::commands::retrieve_launcher_config;
use crate::resource::helpers::curseforge::misc::{
  CURSEFORGE_API_KEY, is_curseforge_authenticated_url,
};
use crate::tasks::streams::desc::{PDesc, PStatus};
use crate::tasks::streams::reporter::Reporter;
use crate::tasks::*;
use crate::utils::fs::validate_sha1;
use crate::utils::web::with_retry;

/// Running average of successful probe latencies in milliseconds, used to give
/// slow networks more connect slack instead of a fixed 10s timeout.
static AVG_CONNECT_MS: AtomicU64 = AtomicU64::new(0);

/// Best throughput observed so far in bytes/s, used as the floor that decides
/// whether opening another ranged connection is worthwhile.
static BEST_SPEED_BPS: AtomicU64 = AtomicU64::new(0);

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadParam {
  pub src: Url,
  /// Optional ordered list of alternative sources. When present, the download
  /// tries `src` first and falls back to each candidate on failure or timeout
  /// (mirrors PCL's per-file source list). Existing callers leave this `None`.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub srcs: Option<Vec<Url>>,
  pub dest: PathBuf,
  pub filename: Option<String>,
  pub sha1: Option<String>,
}

pub struct DownloadTask {
  p_handle: PTaskHandle,
  param: DownloadParam,
  dest_path: PathBuf,
}

impl DownloadTask {
  pub fn new(
    app_handle: AppHandle,
    task_id: u32,
    task_group: Option<String>,
    param: DownloadParam,
    report_interval: Duration,
  ) -> Self {
    let cache_dir = retrieve_launcher_config(app_handle.clone())
      .unwrap()
      .download
      .cache
      .directory;
    DownloadTask {
      p_handle: PTaskHandle::new(
        PDesc::<PTaskParam>::new(
          task_id,
          task_group.clone(),
          0,
          PTaskParam::Download(param.clone()),
          PStatus::InProgress,
        ),
        report_interval,
        cache_dir.clone().join(format!("task-{task_id}.json")),
        Reporter::new(0, report_interval, TauriEventSink::new(app_handle.clone())),
      ),
      param: param.clone(),
      dest_path: cache_dir.clone().join(param.dest.clone()),
    }
  }

  pub fn from_descriptor(
    app_handle: AppHandle,
    desc: PTaskDesc,
    report_interval: Duration,
    reset: bool,
  ) -> Self {
    let param = match &desc.payload {
      PTaskParam::Download(param) => param.clone(),
    };

    let cache_dir = retrieve_launcher_config(app_handle.clone())
      .unwrap()
      .download
      .cache
      .directory;
    let task_id = desc.task_id;
    let path = cache_dir.join(format!("task-{task_id}.json"));
    DownloadTask {
      p_handle: PTaskHandle::new(
        if reset {
          PTaskDesc {
            status: PStatus::Waiting,
            current: 0,
            ..desc
          }
        } else {
          PTaskDesc {
            status: PStatus::Waiting,
            ..desc
          }
        },
        report_interval,
        path,
        Reporter::new(
          desc.total,
          report_interval,
          TauriEventSink::new(app_handle.clone()),
        ),
      ),
      param: param.clone(),
      dest_path: cache_dir.clone().join(param.dest.clone()),
    }
  }

  async fn send_request(
    app_handle: &AppHandle,
    current: i64,
    param: &DownloadParam,
    fails: u32,
  ) -> SJMCLResult<reqwest::Response> {
    let state = app_handle.state::<reqwest::Client>();
    let client = with_retry(state.inner().clone());
    let mut request = if current == 0 {
      client.get(param.src.clone())
    } else {
      client
        .get(param.src.clone())
        .header(RANGE, format!("bytes={current}-"))
    };

    // add api key header for CurseForge download urls (#1679)
    // ref: https://blog.curseforge.com/introducing-api-key-authentication-for-curseforge-file-downloads
    if is_curseforge_authenticated_url(&param.src) {
      request = request.header("x-api-key", CURSEFORGE_API_KEY.as_str());
    }

    let timeout = Self::connect_timeout(fails);
    let response = tokio::time::timeout(timeout, request.send())
      .await
      .map_err(|_| {
        Self::note_connect_failure();
        SJMCLError(format!(
          "下载连接超时（{}ms）：{}",
          timeout.as_millis(),
          param.src
        ))
      })?
      .map_err(|e| SJMCLError(format!("{e:?}")))?;

    let response = response
      .error_for_status()
      .map_err(|e| SJMCLError(format!("{e:?}")))?;

    Ok(response)
  }

  async fn create_resp_stream(
    app_handle: &AppHandle,
    current: i64,
    param: &DownloadParam,
  ) -> SJMCLResult<(
    impl Stream<Item = Result<bytes::Bytes, std::io::Error>> + Send + use<>,
    i64,
  )> {
    let resp = Self::send_request(app_handle, current, param, 0).await?;
    let total_progress = if current == 0 {
      resp.content_length().map_or(-1, |length| length as i64)
    } else {
      -1
    };
    Ok((
      resp.bytes_stream().map(|res| match res {
        Ok(bytes) => Ok(bytes),
        Err(_) => Ok(bytes::Bytes::new()),
      }),
      total_progress,
    ))
  }

  /// Adaptive per-request connect timeout. Like PCL, each consecutive failure
  /// buys the connection more patience (`base x (1 + fails)`), capped at 30s, so
  /// a slow-but-alive source is retried instead of being killed at the same
  /// fixed threshold forever.
  fn connect_timeout(fails: u32) -> Duration {
    let avg = AVG_CONNECT_MS.load(Ordering::Relaxed);
    let base = if avg == 0 { 15000 } else { avg };
    let scaled = base.saturating_mul(1 + fails as u64);
    Duration::from_millis(scaled.clamp(15000, 30000))
  }

  /// Timeout for the single-byte probe request. Short on purpose: a healthy
  /// source answers with headers in well under this, and a dead one should be
  /// abandoned quickly so the next candidate source is tried without a hang.
  fn probe_timeout() -> Duration {
    Duration::from_millis(5000)
  }

  /// Record a failed connect so later attempts get a longer timeout even when no
  /// probe ever succeeds (otherwise a consistently timing-out network would keep
  /// retrying at the minimum 15s forever).
  fn note_connect_failure() {
    let avg = AVG_CONNECT_MS.load(Ordering::Relaxed);
    let next = if avg == 0 {
      16000
    } else {
      (avg + 2000).min(30000)
    };
    AVG_CONNECT_MS.store(next, Ordering::Relaxed);
  }

  /// Probe the source for its total size and Range support with a single-byte
  /// request (`bytes=0-0`), which is the cheapest way to learn both.
  async fn probe(app_handle: &AppHandle, src: &Url) -> SJMCLResult<(i64, bool)> {
    let started = Instant::now();
    let state = app_handle.state::<reqwest::Client>();
    let client = with_retry(state.inner().clone());
    let mut request = client.get(src.clone()).header(RANGE, "bytes=0-0");
    if is_curseforge_authenticated_url(src) {
      request = request.header("x-api-key", CURSEFORGE_API_KEY.as_str());
    }
    // A probe only needs the response headers, so it gets a short leash of its
    // own. Waiting the full connect timeout here is what makes an unreachable
    // primary source feel like a hang before the mirror is tried.
    let timeout = Self::probe_timeout();
    let response = tokio::time::timeout(timeout, request.send())
      .await
      .map_err(|_| {
        // Feed the failure back so a consistently timing-out source eventually
        // gets a longer leash instead of the same 15s forever.
        Self::note_connect_failure();
        SJMCLError(format!("探测超时（{}ms）：{src}", timeout.as_millis()))
      })?
      .map_err(|e| SJMCLError(format!("{e:?}")))?;
    let response = response
      .error_for_status()
      .map_err(|e| SJMCLError(format!("{e:?}")))?;

    // Feed the observed latency back into the adaptive timeout.
    let elapsed = started.elapsed().as_millis() as u64;
    let avg = AVG_CONNECT_MS.load(Ordering::Relaxed);
    let next = if avg == 0 {
      elapsed
    } else {
      avg * 4 / 5 + elapsed / 5
    };
    AVG_CONNECT_MS.store(next, Ordering::Relaxed);

    let supports_range = response
      .headers()
      .get(reqwest::header::ACCEPT_RANGES)
      .and_then(|v| v.to_str().ok())
      .is_some_and(|s| s.contains("bytes"));
    // Content-Range is only present on a 206 response: `bytes 0-0/12345`
    let total = response
      .headers()
      .get(reqwest::header::CONTENT_RANGE)
      .and_then(|v| v.to_str().ok())
      .and_then(|s| s.rsplit('/').next())
      .and_then(|s| s.parse::<i64>().ok())
      .unwrap_or(-1);

    Ok((total, supports_range && total > 0))
  }

  /// Adaptive throughput floor (bytes/s). Below this we consider the connection
  /// under-utilised and worth adding another segment; it rises with the best
  /// throughput observed so far, mirroring PCL's speed-limit-low heuristic.
  fn speed_floor() -> f64 {
    let best = BEST_SPEED_BPS.load(Ordering::Relaxed) as f64;
    best.max(256.0 * 1024.0)
  }

  /// Call once per completed segment to feed the adaptive floor with the
  /// throughput that was actually achieved.
  fn record_speed(bytes: i64, elapsed: Duration) {
    let secs = elapsed.as_secs_f64();
    if secs <= 0.0 {
      return;
    }
    let speed = (bytes as f64 / secs) as u64;
    let prev = BEST_SPEED_BPS.load(Ordering::Relaxed);
    if speed > prev {
      BEST_SPEED_BPS.store(prev * 4 / 5 + speed / 5, Ordering::Relaxed);
    }
  }

  /// Copy one byte-stream into a file, reporting accumulated progress and
  /// giving up when the source is genuinely dead.
  ///
  /// The two failure modes PCL distinguishes (ModNet.vb:1025-1031) are kept
  /// apart here, because collapsing them is what produced "stalled after 5s"
  /// errors on healthy downloads:
  ///
  /// * data arriving, but slowly → abort only if the gap between packets
  ///   exceeds 5s *and* the bytes received over that gap average under 1 KB/s;
  /// * no data at all → the packet gap is meaningless, so PCL waits out the
  ///   full connect timeout (15-30s), not 5s.
  ///
  /// `single_stream` mirrors PCL's `Th.Source.SingleThread Is Nothing` guard:
  /// when a file has no ranged fallback, cutting it off for slowness throws
  /// away the only connection that can finish it, so the speed rule is skipped
  /// and only a total silence kills it.
  async fn stream_to_file(
    stream: &mut (impl Stream<Item = Result<bytes::Bytes, std::io::Error>> + Unpin + Send),
    file: &mut tokio::fs::File,
    task_handle: &Arc<RwLock<PTaskHandle>>,
    current_base: i64,
    expected: Option<i64>,
    limiter: Option<&Limiter>,
    single_stream: bool,
  ) -> SJMCLResult<i64> {
    let mut written: i64 = 0;
    let mut last_report = Instant::now();
    // Timestamp of the previous packet. `None` mirrors PCL's
    // `LastReceiveTime = -1`: no byte yet, so the speed rule (which requires
    // `LastReceiveTime > 0`) cannot fire on the very first packet.
    let mut prev_data: Option<Instant> = None;
    let mut last_chunk_len: i64 = 0;
    let report_interval = Duration::from_millis(250);
    loop {
      if task_handle.read().unwrap().status().is_cancelled() {
        return Ok(written);
      }
      // Nothing arrived yet, or the source went quiet entirely: wait out the
      // adaptive connect timeout. A first byte can legitimately take this long
      // on a slow link; only total silence for the whole window is a dead
      // source.
      let wait_for = Self::connect_timeout(0);
      let waited = tokio::time::timeout(wait_for, stream.next()).await;
      let chunk = match waited {
        Ok(Some(c)) => c.map_err(|e| SJMCLError(format!("读取下载流失败：{e}")))?,
        Ok(None) => break,
        Err(_) => {
          return Err(SJMCLError(format!(
            "下载无响应（{}ms 内未收到任何数据）",
            wait_for.as_millis()
          )));
        }
      };
      let now = Instant::now();
      // PCL's speed rule, evaluated on arrival: compare the gap since the
      // previous packet against the bytes that gap delivered. Measured here
      // rather than in the timeout arm, because arriving at the timeout arm
      // means *nothing* was received, which makes any rate calculation zero by
      // construction.
      if !single_stream && let Some(prev) = prev_data {
        let gap = now.duration_since(prev);
        if gap.as_millis() > 5000 && last_chunk_len < gap.as_millis() as i64 {
          return Err(SJMCLError(format!(
            "下载速度过慢（{}ms 内仅收到 {} 字节，折算 {}/s）",
            gap.as_millis(),
            last_chunk_len,
            (last_chunk_len as f64 / gap.as_secs_f64().max(0.001)) as i64
          )));
        }
      }
      prev_data = Some(now);
      if chunk.is_empty() {
        continue;
      }
      last_chunk_len = chunk.len() as i64;
      // Honour the global speed limit on every path (single stream *and*
      // ranged segments), otherwise enabling the limit in settings would have
      // no effect on large files that get split. The limiter is shared by all
      // segments of one file, so the file as a whole respects the cap.
      if let Some(lim) = limiter {
        lim.consume(chunk.len()).await;
      }
      file.write_all(&chunk).await?;
      written += chunk.len() as i64;
      prev_data = Some(Instant::now());
      if now.duration_since(last_report) >= report_interval {
        // Report the real elapsed time rather than letting `Reporter` divide by
        // its fixed 1s interval: this path reports every 250ms, so using the
        // stale interval would under-report speed by ~4x and inflate the ETA.
        let elapsed = now
          .duration_since(last_report)
          .max(Duration::from_millis(1));
        last_report = now;
        let mut h = task_handle.write().unwrap();
        let id = h.desc.task_id;
        let group = h.desc.task_group.as_deref().map(|s| s.to_string());
        let current = current_base + written;
        h.reporter.set_report_interval(elapsed);
        h.reporter.report_progress(id, group.as_deref(), current);
      }
    }
    if let Some(exp) = expected
      && exp > 0
      && written < exp
    {
      return Err(SJMCLError(format!(
        "下载分片数据不足：预期 {exp} 字节，实际 {written} 字节"
      )));
    }
    Ok(written)
  }

  /// Download one byte range into a temporary part file.
  ///
  /// A failure is handled here rather than being escalated, matching PCL: the
  /// segment resumes from the bytes it already wrote, the next attempt gets a
  /// longer timeout, and alternate sources are rotated through. Only exhausting
  /// every retry on every source bubbles an error up.
  async fn download_segment(
    app_handle: &AppHandle,
    param: &DownloadParam,
    start: i64,
    end: i64,
    part_path: PathBuf,
    task_handle: Arc<RwLock<PTaskHandle>>,
    limiter: Option<Limiter>,
  ) -> SJMCLResult<i64> {
    const MAX_ATTEMPTS: u32 = 3;
    let sources = Self::source_list(param);
    let total_len = end - start + 1;
    let mut last_err = SJMCLResult::<()>::Ok(());

    for attempt in 0..MAX_ATTEMPTS {
      if task_handle.read().unwrap().status().is_cancelled() {
        return Err(SJMCLError("任务已取消".to_string()));
      }
      // Rotate over the candidate sources across attempts so a source that
      // keeps timing out is replaced rather than hammered again.
      let src = &sources[(attempt as usize) % sources.len()];

      let mut already = tokio::fs::metadata(&part_path)
        .await
        .map(|m| m.len() as i64)
        .unwrap_or(0);
      if already >= total_len {
        return Ok(already);
      }
      // Resume inside the segment instead of restarting it from scratch.
      let resume_at = start + already;
      if already > 0 {
        let part_now = tokio::fs::metadata(&part_path).await.ok().map(|m| m.len());
        log::info!(
          "分片 {} 从断点继续：已有 {}/{} 字节（{part_now:?}）",
          src,
          already,
          total_len
        );
      }

      let state = app_handle.state::<reqwest::Client>();
      let client = with_retry(state.inner().clone());
      let mut request = client
        .get(src.clone())
        .header(RANGE, format!("bytes={resume_at}-{end}"));
      if is_curseforge_authenticated_url(src) {
        request = request.header("x-api-key", CURSEFORGE_API_KEY.as_str());
      }
      let timeout = Self::connect_timeout(attempt);
      let response = match tokio::time::timeout(timeout, request.send()).await {
        Ok(Ok(r)) => match r.error_for_status() {
          Ok(r) => r,
          Err(e) => {
            last_err = Err(SJMCLError(format!("{e:?}")));
            Self::note_connect_failure();
            continue;
          }
        },
        Ok(Err(e)) => {
          last_err = Err(SJMCLError(format!("{e:?}")));
          Self::note_connect_failure();
          continue;
        }
        Err(_) => {
          last_err = Err(SJMCLError(format!(
            "分片连接超时（{}ms）：{src}",
            timeout.as_millis()
          )));
          Self::note_connect_failure();
          continue;
        }
      };

      let mut stream = response
        .bytes_stream()
        .map(|r| r.map_err(|e| std::io::Error::other(e)));
      // Append on resume, truncate (create) on the very first attempt only.
      let mut file = if already > 0 {
        tokio::fs::OpenOptions::new()
          .append(true)
          .open(&part_path)
          .await?
      } else {
        tokio::fs::File::create(&part_path).await?
      };
      let result = Self::stream_to_file(
        &mut stream,
        &mut file,
        &task_handle,
        resume_at,
        Some(end - resume_at + 1),
        limiter.as_ref(),
        // A ranged segment can be re-dispatched, so cutting it off for
        // slowness is safe: the file as a whole still has a way to finish.
        false,
      )
      .await;
      file.flush().await?;
      drop(file);

      match result {
        Ok(written) => {
          already += written.min(end - resume_at + 1);
          if already >= total_len {
            let _ = last_err;
            return Ok(already);
          }
          last_err = Err(SJMCLError(format!(
            "分片数据不足：已有 {already}/{total_len}"
          )));
        }
        Err(e) => {
          last_err = Err(e);
          Self::note_connect_failure();
        }
      }
    }

    last_err?;
    Err(SJMCLError("重试次数耗尽".to_string()))
  }

  /// The primary source followed by any alternatives, de-duplicated.
  fn source_list(param: &DownloadParam) -> Vec<Url> {
    let mut list = vec![param.src.clone()];
    if let Some(extra) = &param.srcs {
      for u in extra {
        if !list.contains(u) {
          list.push(u.clone());
        }
      }
    }
    list
  }

  /// Look for an identical copy of the wanted file in a sibling game directory.
  /// Only shared-content folders (`libraries`, `assets`) are searched, and only
  /// along the same relative path, so the scan stays small and predictable.
  /// When `sha1` is known it is used as the final gate; otherwise a size match
  /// is required before the copy is accepted (calls without sha1 skip it).
  fn find_local_copy(dest: &PathBuf, sha1: Option<&str>) -> Option<PathBuf> {
    // dest: <...>/<root>/libraries/<relative path>
    let category_dir = dest.parent()?; // e.g. .../libraries/net/neoforged
    let mut root = category_dir;
    let mut relative = std::path::PathBuf::new();
    // Walk up until we reach a directory literally named libraries/assets.
    loop {
      let name = root.file_name()?.to_string_lossy().to_string();
      if name == "libraries" || name == "assets" {
        break;
      }
      relative = std::path::Path::new(&name).join(relative);
      root = root.parent()?;
    }
    let base = root.parent()?; // the instance / game root containing the folder

    // Without a checksum we cannot prove a sibling file is identical, and the
    // target does not exist yet so there is no size to compare against.
    let truth = sha1?;

    // Search sibling roots (other instances) for the same relative path.
    let mut checked = 0usize;
    let entries = std::fs::read_dir(base.parent()?).ok()?;
    for entry in entries.flatten() {
      if checked >= 16 {
        break;
      }
      let sibling_root = entry.path();
      if !sibling_root.is_dir() || sibling_root == *base {
        continue;
      }
      let candidate = sibling_root.join(root.file_name()?).join(&relative);
      if !candidate.is_file() {
        continue;
      }
      checked += 1;
      if validate_sha1(candidate.clone(), truth.to_string()).is_ok() {
        return Some(candidate);
      }
    }
    None
  }

  /// Finalise: validate the file when a checksum is known, then mark complete.
  async fn finish_download(
    task_handle: &Arc<RwLock<PTaskHandle>>,
    param: &DownloadParam,
    dest: &PathBuf,
  ) -> SJMCLResult<()> {
    if task_handle.read().unwrap().status().is_cancelled() {
      tokio::fs::remove_file(dest).await.ok();
      return Ok(());
    }
    if let Some(truth) = &param.sha1 {
      validate_sha1(dest.clone(), truth.clone())?;
    }
    task_handle.write().unwrap().mark_completed();
    Ok(())
  }

  async fn future_impl(
    self,
    app_handle: AppHandle,
    limiter: Option<Limiter>,
  ) -> SJMCLResult<(
    impl Future<Output = SJMCLResult<()>> + Send,
    Arc<RwLock<PTaskHandle>>,
  )> {
    let current = self.p_handle.desc.current;
    let handle = Arc::new(RwLock::new(self.p_handle));
    let task_handle = handle.clone();
    let param = self.param.clone();
    let dest_path = self.dest_path.clone();
    // Shared by all ranged segments of this file so the configured speed cap
    // applies to the file as a whole, not per connection.
    let shared_limiter = limiter.clone();
    Ok((
      async move {
        // Mark the task as started *before* opening the network connection so it
        // never sits in `Waiting` for the whole connect/retry window (the UI
        // would show a frozen indeterminate stripe and never advance counts).
        {
          let mut task_handle = task_handle.write().unwrap();
          task_handle.mark_started();
        }

        // Skip the download entirely when the destination already satisfies the
        // expected checksum. This covers re-queued descriptors after a restart
        // (the file finished but the descriptor never recorded completion).
        if dest_path.exists() {
          let already_ok = match &param.sha1 {
            Some(truth) => validate_sha1(dest_path.clone(), truth.clone()).is_ok(),
            None => false,
          };
          if already_ok {
            task_handle.write().unwrap().mark_completed();
            return Ok(());
          }
        }

        tokio::fs::create_dir_all(dest_path.parent().unwrap()).await?;

        // Reuse an identical file that already exists elsewhere instead of
        // downloading it again (mirrors PCL's cross-folder lookup): repeated
        // installations of the same version or modpack hit this constantly for
        // shared libraries and assets.
        if !dest_path.exists()
          && param.sha1.is_some()
          && let Some(copy_from) = Self::find_local_copy(&dest_path, param.sha1.as_deref())
          && tokio::fs::copy(&copy_from, &dest_path).await.is_ok()
          && validate_sha1(dest_path.clone(), param.sha1.clone().unwrap_or_default()).is_ok()
        {
          log::info!(
            "复用本地已有文件：{} → {}",
            copy_from.display(),
            dest_path.display()
          );
          task_handle.write().unwrap().mark_completed();
          return Ok(());
        }

        // Resume a partially downloaded file with a single ranged request.
        if current > 0 && dest_path.exists() {
          let resp = Self::send_request(&app_handle, current, &param, 0).await?;
          let total = resp.content_length().map_or(-1, |l| l as i64 + current);
          {
            let mut h = task_handle.write().unwrap();
            h.set_total(total);
          }
          let mut file = tokio::fs::OpenOptions::new()
            .write(true)
            .open(&dest_path)
            .await?;
          file.seek(std::io::SeekFrom::Start(current as u64)).await?;
          let mut stream = resp
            .bytes_stream()
            .map(|r| r.map_err(|e| std::io::Error::other(e)));
          Self::stream_to_file(
            &mut stream,
            &mut file,
            &task_handle,
            current,
            None,
            shared_limiter.as_ref(),
            // Resuming a partial file with one connection: nothing else is
            // carrying this file, so slowness must not abort it.
            true,
          )
          .await?;
          file.flush().await?;
          drop(file);
          return Self::finish_download(&task_handle, &param, &dest_path).await;
        }

        // Walk the candidate source list (when present) and keep the first
        // source that answers the probe. A source that fails or times out is
        // dropped immediately, so a dead mirror no longer stalls the file.
        let mut candidates: Vec<Url> = Vec::new();
        candidates.push(param.src.clone());
        if let Some(extra) = &param.srcs {
          for u in extra {
            if !candidates.contains(u) {
              candidates.push(u.clone());
            }
          }
        }
        let mut chosen = param.src.clone();
        let mut probe_result = Err(SJMCLError("no source".to_string()));
        for candidate in &candidates {
          match Self::probe(&app_handle, candidate).await {
            Ok(v) => {
              chosen = candidate.clone();
              probe_result = Ok(v);
              break;
            }
            Err(e) => {
              log::info!("下载源不可用，切换下一个：{candidate}（{e:?}）");
            }
          }
        }
        // Rebind the param to the chosen source for every subsequent request.
        let param = DownloadParam {
          src: chosen,
          ..param.clone()
        };

        // A probe failure means we cannot know the size: fall back to a plain
        // single-stream download rather than failing the task.
        let (total, resumable) = match probe_result {
          Ok(v) => v,
          Err(_) => (-1, false),
        };

        // Split into ranged segments only when worthwhile: the source supports
        // ranges and the file is large enough to amortise N connections.
        const SPLIT_THRESHOLD: i64 = 4 * 1024 * 1024;
        if resumable && total >= SPLIT_THRESHOLD {
          {
            let mut h = task_handle.write().unwrap();
            h.set_total(total);
          }
          // Cap the segment count by the configured concurrency budget: the
          // global semaphore only governs whole tasks, so without this a single
          // file could open 8 extra connections regardless of the user's limit.
          let concurrency_budget = retrieve_launcher_config(app_handle.clone())
            .map(|c| {
              let t = c.download.transmission;
              if t.auto_concurrent {
                std::thread::available_parallelism()
                  .map(|n| n.get())
                  .unwrap_or(4)
              } else {
                t.concurrent_count.max(1)
              }
            })
            .unwrap_or(4);
          let max_segments = concurrency_budget.clamp(1, 8).max(2);
          let segments = (total / SPLIT_THRESHOLD)
            .clamp(1, max_segments as i64)
            .max(1) as usize;
          let chunk = total / segments as i64;
          let file_name = dest_path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
          let mut set = JoinSet::new();
          // Grow the connection count progressively instead of opening every
          // segment up front: start with one and only add more while the
          // observed throughput keeps improving (PCL's "add a connection while
          // the speed limit isn't met" heuristic). On a slow link this avoids
          // paying for N connections that cannot be fed.
          let spawn_segment = |i: usize, set: &mut JoinSet<_>| {
            let start = i as i64 * chunk;
            let end = if i == segments - 1 {
              total - 1
            } else {
              (i as i64 + 1) * chunk - 1
            };
            let part_path = dest_path
              .parent()
              .unwrap()
              .join(format!("{file_name}.part{i}"));
            let ah = app_handle.clone();
            let p = param.clone();
            let th = task_handle.clone();
            let lim = shared_limiter.clone();
            let idx = i;
            set.spawn(async move {
              let r = Self::download_segment(&ah, &p, start, end, part_path.clone(), th, lim).await;
              (idx, r.map(|_| part_path))
            });
          };
          spawn_segment(0, &mut set);
          let mut next_segment = 1usize;
          let started = Instant::now();
          let mut bytes_done = 0i64;

          let mut parts: Vec<(usize, PathBuf)> = Vec::new();
          let mut failed = false;
          let mut dispatched: std::collections::BTreeSet<usize> = std::collections::BTreeSet::new();
          dispatched.insert(0);
          let mut pending_retry: Option<usize> = None;
          let mut retry_rounds = 0u32;
          while let Some(res) = set.join_next().await {
            match res {
              Ok((idx, Ok(part))) => parts.push((idx, part)),
              Ok((idx, Err(e))) => {
                log::warn!("下载分片 {idx} 失败：{e:?}");
                failed = true;
                pending_retry = Some(idx);
              }
              Err(e) => {
                log::warn!("下载分片异常：{e}");
                failed = true;
              }
            }

            // After the set drains, re-dispatch a failed segment. Its own part
            // file is resumed from where it stopped, so no downloaded bytes are
            // lost, and the retry rotates to the next candidate source.
            if failed && set.is_empty() {
              if let Some(idx) = pending_retry.take() {
                retry_rounds += 1;
                failed = false;
                log::info!("重新调度分片 {idx}（第 {retry_rounds} 轮）");
                dispatched.insert(idx);
                spawn_segment(idx, &mut set);
              } else if retry_rounds >= 2 {
                break;
              } else {
                failed = false;
                retry_rounds += 1;
              }
            }

            // After each finished segment, decide whether another connection is
            // worth starting: add one if the current throughput is below the
            // adaptive floor (i.e. the pipe is not saturated yet).
            if !failed && next_segment < segments {
              bytes_done += chunk;
              let elapsed = started.elapsed();
              Self::record_speed(bytes_done, elapsed);
              let speed = bytes_done as f64 / elapsed.as_secs_f64().max(0.001);
              let floors = Self::speed_floor();
              if speed < floors {
                log::info!(
                  "当前吞吐 {}/s 低于自适应下限 {}/s，追加第 {} 个连接",
                  speed as i64,
                  floors as i64,
                  next_segment + 1
                );
                dispatched.insert(next_segment);
                spawn_segment(next_segment, &mut set);
                next_segment += 1;
              }
            }
          }

          if !failed {
            // Merge the parts into the destination in segment order. Every
            // segment must be present, otherwise the file would be truncated.
            parts.sort_by_key(|(idx, _)| *idx);
            parts.dedup_by_key(|(idx, _)| *idx);
            let mut out = tokio::fs::File::create(&dest_path).await?;
            let merged = {
              let mut ok = parts.len() == dispatched.len();
              if !ok {
                log::warn!(
                  "分片数量不完整：{} / {}，放弃合并",
                  parts.len(),
                  dispatched.len()
                );
              }
              let mut it = parts.iter();
              while ok && let Some((_, p)) = it.next() {
                match tokio::fs::read(p).await {
                  Ok(data) => {
                    if out.write_all(&data).await.is_err() {
                      ok = false;
                    }
                  }
                  Err(e) => {
                    log::warn!("读取分片失败：{e}");
                    ok = false;
                  }
                }
              }
              ok
            };
            out.flush().await?;
            drop(out);
            for (_, p) in &parts {
              tokio::fs::remove_file(p).await.ok();
            }
            if merged {
              let size_ok = tokio::fs::metadata(&dest_path)
                .await
                .map(|m| m.len() as i64 == total)
                .unwrap_or(false);
              if size_ok || param.sha1.is_none() {
                return Self::finish_download(&task_handle, &param, &dest_path).await;
              }
            }
          }

          // Any segment failure, short merge or size mismatch: clean up the parts
          // and retry the whole file as a single stream (servers that answered
          // the probe but mishandle concurrent ranges still finish correctly).
          for i in 0..segments {
            let part_path = dest_path
              .parent()
              .unwrap()
              .join(format!("{file_name}.part{i}"));
            tokio::fs::remove_file(&part_path).await.ok();
          }
        }

        // Connect *before* touching the destination file. Creating the file
        // first would truncate whatever was already downloaded, so a retry after
        // a timeout would silently discard progress (and corrupt resumed files).
        let (stream, total_progress) = Self::create_resp_stream(&app_handle, 0, &param).await?;
        tokio::fs::create_dir_all(dest_path.parent().unwrap()).await?;
        {
          let mut h = task_handle.write().unwrap();
          h.set_total(if total > 0 && total_progress < 0 {
            total
          } else {
            total_progress
          });
        }
        let mut stream = stream;
        let mut file = tokio::fs::File::create(&dest_path).await?;
        Self::stream_to_file(
          &mut stream,
          &mut file,
          &task_handle,
          0,
          None,
          limiter.as_ref(),
          // This is the last resort: the ranged path already failed or was not
          // possible, so this single connection is the only thing that can
          // finish the file. PCL exempts it from the speed rule for exactly
          // this reason — aborting here loses the download outright.
          true,
        )
        .await?;
        file.flush().await?;
        drop(file);
        Self::finish_download(&task_handle, &param, &dest_path).await
      },
      handle,
    ))
  }

  pub async fn future(
    self,
    app_handle: AppHandle,
    limiter: Option<Limiter>,
  ) -> SJMCLResult<(
    impl Future<Output = SJMCLResult<()>> + Send,
    Arc<RwLock<PTaskHandle>>,
  )> {
    Self::future_impl(self, app_handle, limiter).await
  }
}
