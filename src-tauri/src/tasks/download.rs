use crate::error::{SJMCLError, SJMCLResult};
use crate::launcher_config::commands::retrieve_launcher_config;
use crate::utils::fs::validate_sha1;

use async_speed_limit::Limiter;
use futures::stream::TryStreamExt;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::future::Future;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tauri::{AppHandle, Manager, Url};
use tauri_plugin_http::reqwest;
use tauri_plugin_http::reqwest::header::RANGE;
use tokio::io::AsyncSeekExt;
use tokio_util::bytes;
use tokio_util::compat::FuturesAsyncReadCompatExt;

use super::streams::desc::{PDesc, PStatus};
use super::streams::reporter::Reporter;
use super::streams::ProgressStream;
use super::*;
use crate::utils::web::with_retry;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadParam {
  pub src: Url,
  pub dest: PathBuf,
  pub filename: Option<String>,
  pub sha1: Option<String>,
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
          PStatus::InProgress,
        ),
        Duration::from_secs(1),
        cache_dir.clone().join(format!("task-{task_id}.json")),
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

  async fn send_request(
    app_handle: &AppHandle,
    current: i64,
    param: &DownloadParam,
  ) -> SJMCLResult<reqwest::Response> {
    let state = app_handle.state::<reqwest::Client>();
    let client = with_retry(state.inner().clone());
    let request = if current == 0 {
      client.get(param.src.clone())
    } else {
      client
        .get(param.src.clone())
        .header(RANGE, format!("bytes={current}-"))
    };

    let response = request
      .send()
      .await
      .map_err(|e| SJMCLError(format!("{:?}", e.source())))?;

    let response = response
      .error_for_status()
      .map_err(|e| SJMCLError(format!("{:?}", e.source())))?;

    Ok(response)
  }

  async fn create_resp_stream(
    app_handle: &AppHandle,
    current: i64,
    param: &DownloadParam,
  ) -> SJMCLResult<(
    impl Stream<Item = Result<bytes::Bytes, std::io::Error>> + Send,
    i64,
  )> {
    let resp = Self::send_request(app_handle, current, param).await?;
    let total_progress = if current == 0 {
      resp.content_length().unwrap() as i64
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
    Ok((
      async move {
        let (resp, total_progress) = Self::create_resp_stream(&app_handle, current, &param).await?;
        let stream = ProgressStream::new(resp, task_handle.clone());
        tokio::fs::create_dir_all(&self.dest_path.parent().unwrap()).await?;
        let mut file = if current == 0 {
          tokio::fs::File::create(&self.dest_path).await?
        } else {
          let mut f = tokio::fs::OpenOptions::new().open(&self.dest_path).await?;
          f.seek(std::io::SeekFrom::Start(current as u64)).await?;
          f
        };
        {
          let mut task_handle = task_handle.write().unwrap();
          task_handle.set_total(total_progress);
          task_handle.mark_started();
        }
        if let Some(lim) = limiter {
          tokio::io::copy(&mut lim.limit(stream.into_async_read()).compat(), &mut file).await?;
        } else {
          tokio::io::copy(&mut stream.into_async_read().compat(), &mut file).await?;
        }
        drop(file);
        if task_handle.read().unwrap().status().is_cancelled() {
          tokio::fs::remove_file(&self.dest_path).await?;
          Ok(())
        } else {
          match param.sha1 {
            Some(truth) => validate_sha1(param.dest, truth),
            None => Ok(()),
          }
        }
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
