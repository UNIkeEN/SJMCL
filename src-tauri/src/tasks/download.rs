use crate::error::{SJMCLError, SJMCLResult};
use crate::launcher_config::commands::retrieve_launcher_config;

use async_speed_limit::Limiter;
use futures::stream::TryStreamExt;
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::future::Future;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tauri::{AppHandle, Manager, Url};
use tauri_plugin_http::reqwest;
use tauri_plugin_http::reqwest::header::RANGE;
use tokio::io::AsyncSeekExt;
use tokio_util::{bytes, compat::FuturesAsyncReadCompatExt};

use super::streams::desc::{PDesc, PState};
use super::streams::reporter::Reporter;
use super::streams::ProgressStream;
use super::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadParam {
  src: Url,
  dest: PathBuf,
  sha1: String,
}

pub struct DownloadTask {
  p_handle: PTaskHandle,
  param: DownloadParam,
  dest_path: PathBuf,
  report_interval: Duration,
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
          PState::InProgress,
        ),
        Duration::from_secs(1),
        cache_dir.clone().join(format!("task-{}.json", task_id)),
        Reporter::new(
          0,
          Duration::from_secs(1),
          TauriEventSink::new(app_handle.clone()),
        ),
      ),
      param: param.clone(),
      dest_path: cache_dir.clone().join(param.dest.clone()),
      report_interval,
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
    let path = cache_dir.join(format!("task-{}.json", task_id));
    DownloadTask {
      p_handle: PTaskHandle::new(
        if reset {
          PTaskDesc {
            state: PState::Stopped,
            current: 0,
            ..desc
          }
        } else {
          PTaskDesc {
            state: PState::Stopped,
            ..desc
          }
        },
        Duration::from_secs(1),
        path,
        Reporter::new(
          desc.total,
          Duration::from_secs(1),
          TauriEventSink::new(app_handle.clone()),
        ),
      ),
      param: param.clone(),
      dest_path: cache_dir.clone().join(param.dest.clone()),
      report_interval,
    }
  }

  async fn create_resp(
    app_handle: &AppHandle,
    p_handle: &mut PTaskHandle,
    param: &DownloadParam,
  ) -> SJMCLResult<impl Stream<Item = Result<bytes::Bytes, std::io::Error>> + Send> {
    let client = app_handle.state::<reqwest::Client>().clone();
    Ok(
      if p_handle.desc.total == 0 && p_handle.desc.current == 0 {
        let r = client
          .get(param.src.clone())
          .send()
          .await?
          .error_for_status()?;
        p_handle.set_total(r.content_length().unwrap_or_default() as i64);
        r
      } else {
        client
          .get(param.src.clone())
          .header(RANGE, format!("bytes={}-", p_handle.desc.current))
          .send()
          .await?
          .error_for_status()?
      }
      .bytes_stream()
      .map_err(std::io::Error::other),
    )
  }

  fn validate_sha1(dest_path: PathBuf, param: DownloadParam) -> SJMCLResult<()> {
    let mut f = std::fs::File::options()
      .read(true)
      .create(false)
      .write(false)
      .open(&dest_path)
      .unwrap();
    let mut hasher = Sha1::new();
    std::io::copy(&mut f, &mut hasher).unwrap();
    let sha1 = hex::encode(hasher.finalize());
    if sha1 != param.sha1 {
      Err(SJMCLError(format!(
        "SHA1 mismatch for {}: expected {}, got {}",
        dest_path.display(),
        param.sha1,
        sha1
      )))
    } else {
      Ok(())
    }
  }

  async fn future_impl(
    self,
    resp: impl Stream<Item = Result<bytes::Bytes, std::io::Error>> + Send + Unpin,
    limiter: Option<Limiter>,
  ) -> SJMCLResult<(
    impl Future<Output = SJMCLResult<()>> + Send,
    Arc<RwLock<PTaskHandle>>,
  )> {
    let desc = self.p_handle.desc.clone();
    let handle = Arc::new(RwLock::new(self.p_handle));
    let task_handle = handle.clone();
    let stream = ProgressStream::new(resp, handle.clone());
    let param = self.param.clone();
    let dest_path = self.dest_path.clone();
    Ok((
      async move {
        tokio::fs::create_dir_all(&self.dest_path.parent().unwrap()).await?;
        let mut file = if desc.current == 0 {
          tokio::fs::File::create(&self.dest_path).await?
        } else {
          let mut f = tokio::fs::OpenOptions::new().open(&self.dest_path).await?;
          f.seek(std::io::SeekFrom::Start(desc.current as u64))
            .await?;
          f
        };

        task_handle.write().unwrap().mark_started();
        if let Some(lim) = limiter {
          tokio::io::copy(&mut lim.limit(stream.into_async_read()).compat(), &mut file).await?;
        } else {
          tokio::io::copy(&mut stream.into_async_read().compat(), &mut file).await?;
        }

        drop(file);
        if task_handle.read().unwrap().state().is_cancelled() {
          tokio::fs::remove_file(&self.dest_path).await?;
          Ok(())
        } else {
          Self::validate_sha1(dest_path, param.clone())
        }
      },
      handle,
    ))
  }

  pub async fn future(
    mut self,
    app_handle: AppHandle,
    limiter: Option<Limiter>,
  ) -> SJMCLResult<(
    impl Future<Output = SJMCLResult<()>> + Send,
    Arc<RwLock<PTaskHandle>>,
  )> {
    let resp = Self::create_resp(&app_handle, &mut self.p_handle, &self.param).await?;
    Self::future_impl(self, resp, limiter).await
  }
}
