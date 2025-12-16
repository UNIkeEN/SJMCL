use crate::error::{SJMCLError, SJMCLResult};
use crate::launcher_config::commands::retrieve_launcher_config;
use crate::tasks::streams::desc::{PDesc, PStatus};
use crate::tasks::streams::reporter::Reporter;
use crate::tasks::streams::ProgressStream;
use crate::tasks::*;
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

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadParam {
  pub src: Vec<Url>,
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
    src: Url,
  ) -> SJMCLResult<reqwest::Response> {
    let state = app_handle.state::<reqwest::Client>();
    let client = state.inner().clone();
    let request = if current == 0 {
      client.get(src.clone())
    } else {
      client
        .get(src.clone())
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
    src: Url,
  ) -> SJMCLResult<(
    impl Stream<Item = Result<bytes::Bytes, std::io::Error>> + Send,
    i64,
  )> {
    let resp = Self::send_request(app_handle, current, src.clone()).await?;
    let total_progress = if current == 0 {
      resp.content_length().unwrap_or(0) as i64
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
    let handle = Arc::new(RwLock::new(self.p_handle));
    let task_handle = handle.clone();
    let param = self.param.clone();
    Ok((
      async move {
        tokio::fs::create_dir_all(&self.dest_path.parent().unwrap()).await?;
        let mut last_err: Option<SJMCLError> = None;
        for src in param.src.clone() {
          let attempt = async {
            let current = task_handle.read().unwrap().desc.current;
            let (resp, total_progress) =
              Self::create_resp_stream(&app_handle, current, src).await?;
            let stream = ProgressStream::new(resp, task_handle.clone());
            let mut file = if current == 0 {
              tokio::fs::File::create(&self.dest_path).await?
            } else {
              let mut f = tokio::fs::OpenOptions::new().open(&self.dest_path).await?;
              f.seek(std::io::SeekFrom::Start(current as u64)).await?;
              f
            };
            {
              let mut h = task_handle.write().unwrap();
              h.set_total(total_progress);
              h.mark_started();
            }
            if let Some(lim) = limiter.clone() {
              tokio::io::copy(&mut lim.limit(stream.into_async_read()).compat(), &mut file).await?;
            } else {
              tokio::io::copy(&mut stream.into_async_read().compat(), &mut file).await?;
            }
            drop(file);
            if task_handle.read().unwrap().status().is_cancelled() {
              tokio::fs::remove_file(&self.dest_path).await?;
              Ok(())
            } else {
              match &param.sha1 {
                Some(truth) => validate_sha1(self.dest_path.clone(), truth.clone()),
                None => Ok(()),
              }
            }
          }
          .await;

          match attempt {
            Ok(()) => {
              if !task_handle.read().unwrap().status().is_cancelled() {
                let mut h = task_handle.write().unwrap();
                h.mark_completed();
              }
              return Ok(());
            }
            Err(e) => {
              last_err = Some(e);
              let _ = tokio::fs::remove_file(&self.dest_path).await;
              {
                let mut h = task_handle.write().unwrap();
                h.desc.current = 0;
              }
              continue;
            }
          }
        }
        Err(last_err.unwrap_or_else(|| SJMCLError("All sources failed".into())))
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
