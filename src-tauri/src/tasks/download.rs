use crate::error::SJMCLResult;
use crate::launcher_config::commands::retrieve_launcher_config;
use crate::tasks::*;
use futures::stream::TryStreamExt;
use governor::{prelude::StreamRateLimitExt, DefaultDirectRateLimiter};
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Url};
use tauri_plugin_http::reqwest::{header::RANGE, Client};
use tokio::io::AsyncSeekExt;
use tokio_util::{bytes, compat::FuturesAsyncReadCompatExt};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DownloadParam {
  src: Url,
  dest: PathBuf,
}

pub struct DownloadTask {
  app_handle: AppHandle,
  task_state: TaskState,
  report_interval: Duration,
  param: DownloadParam,
  path: PathBuf,
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
      app_handle,
      task_state: TaskState::new(
        task_id,
        task_group,
        TaskType::Download,
        0,
        cache_dir.clone(),
        TaskParam::Download(param.clone()),
        MonitorState::InProgress,
      ),
      param: param.clone(),
      path: cache_dir.clone().join(param.dest.clone()),
      report_interval,
    }
  }

  async fn create_resp(
    task_state: &mut TaskState,
    param: &DownloadParam,
  ) -> SJMCLResult<impl Stream<Item = Result<bytes::Bytes, std::io::Error>>> {
    let client = Client::new();
    Ok(
      if task_state.total == 0 && task_state.current == 0 {
        let r = client
          .get(param.src.clone())
          .send()
          .await?
          .error_for_status()?;
        task_state.total = r.content_length().unwrap_or_default() as i64;
        task_state.save()?;
        r
      } else {
        client
          .get(param.src.clone())
          .header(RANGE, format!("bytes={}-", task_state.current))
          .send()
          .await?
          .error_for_status()?
      }
      .bytes_stream()
      .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e)),
    )
  }

  async fn future_impl(
    self,
    resp: impl Stream<Item = Result<bytes::Bytes, std::io::Error>> + Sync + Unpin,
  ) -> SJMCLResult<(
    impl Future<Output = SJMCLResult<()>> + Sync,
    Arc<Mutex<TaskState>>,
  )> {
    let stream = ProgressStream::new(
      self.app_handle.clone(),
      resp,
      self.task_state.clone(),
      self.report_interval,
    );
    let task_state = self.task_state.clone();
    let monitor_state = stream.state();
    let stream_state = monitor_state.clone();
    Ok((
      async move {
        let handle = self.app_handle.clone();
        tokio::fs::create_dir_all(&self.path.parent().unwrap()).await?;
        let mut file = if task_state.current == 0 {
          tokio::fs::File::create(&self.path).await?
        } else {
          let mut f = tokio::fs::OpenOptions::new().open(&self.path).await?;
          f.seek(std::io::SeekFrom::Start(task_state.current as u64))
            .await?;
          f
        };
        TaskEvent::emit_started(
          &handle,
          task_state.task_id,
          task_state.task_group.as_deref(),
          task_state.total,
        );
        tokio::io::copy(&mut stream.into_async_read().compat(), &mut file).await?;
        if stream_state.lock().unwrap().is_cancelled() {
          tokio::fs::remove_file(&self.path).await?;
        }
        Ok(())
      },
      monitor_state,
    ))
  }

  pub async fn future_with_ratelimiter(
    mut self,
    lim: &'_ DefaultDirectRateLimiter,
  ) -> SJMCLResult<(
    impl Future<Output = SJMCLResult<()>> + Sync + '_,
    Arc<Mutex<TaskState>>,
  )> {
    let resp = Self::create_resp(&mut self.task_state, &self.param)
      .await?
      .ratelimit_stream(lim);
    Self::future_impl(self, resp).await
  }

  pub async fn future(
    mut self,
  ) -> SJMCLResult<(
    impl Future<Output = SJMCLResult<()>> + Sync,
    Arc<Mutex<TaskState>>,
  )> {
    let resp = Self::create_resp(&mut self.task_state, &self.param).await?;
    Self::future_impl(self, resp).await
  }
}
