use crate::error::SJMCLResult;
use crate::tasks::*;
use futures::stream::TryStreamExt;
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Url};
use tauri_plugin_http::reqwest::{header::RANGE, Client};
use tokio_util::compat::FuturesAsyncReadCompatExt;

#[derive(Serialize, Deserialize, Clone)]
pub struct DownloadParam {
  src: Url,
  dest: PathBuf,
}

pub struct DownloadTask {
  app_handle: AppHandle,
  task_state: TaskState,
  report_interval: Duration,
}

impl DownloadTask {
  pub fn new(
    app_handle: AppHandle,
    task_id: u32,
    cache_dir: PathBuf,
    param: DownloadParam,
    report_interval: Duration,
  ) -> Self {
    DownloadTask {
      app_handle,
      task_state: TaskState::new(
        task_id,
        0,
        0,
        cache_dir,
        TaskParam::Download(param),
        MonitorState::InProgress,
      ),
      report_interval,
    }
  }

  pub fn from_checkpoint(
    app_handle: AppHandle,
    task_state: &TaskState,
    report_interval: Duration,
  ) -> Self {
    DownloadTask {
      app_handle,
      task_state: task_state.clone(),
      report_interval,
    }
  }

  pub async fn future(
    self,
  ) -> SJMCLResult<(
    impl Future<Output = SJMCLResult<()>> + Sync + 'static,
    Arc<Mutex<TaskState>>,
  )> {
    let download_param = match &self.task_state.task_param {
      TaskParam::Download(p) => p.clone(),
      _ => unreachable!(),
    };

    let client = Client::new();
    let mut local_task_state = self.task_state;
    let resp = if local_task_state.total == 0 && local_task_state.current == 0 {
      let r = client
        .get(download_param.src.clone())
        .send()
        .await?
        .error_for_status()?;
      local_task_state.total = r.content_length().unwrap_or_default() as i64;
      local_task_state.save()?;
      r
    } else {
      client
        .get(download_param.src.clone())
        .header(RANGE, format!("bytes={}-", local_task_state.current))
        .send()
        .await?
        .error_for_status()?
    };

    let task_state = local_task_state.clone();
    let stream = ProgressStream::new(
      self.app_handle.clone(),
      resp
        .bytes_stream()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e)),
      local_task_state,
      self.report_interval,
    );

    let monitor_state = stream.state();
    let stream_state = stream.state();
    Ok((
      async move {
        let handle = self.app_handle.clone();
        let dest = &download_param.dest;
        tokio::fs::create_dir_all(&dest.parent().unwrap()).await?;
        let mut file = if task_state.current == 0 {
          tokio::fs::File::create(dest).await?
        } else {
          tokio::fs::OpenOptions::new()
            .append(true)
            .open(dest)
            .await?
        };
        TaskEvent::emit_started(&handle, task_state.task_id, task_state.total);
        tokio::io::copy(&mut stream.into_async_read().compat(), &mut file).await?;
        if stream_state.lock().unwrap().monitor_state == MonitorState::Cancelled {
          tokio::fs::remove_file(dest).await?;
        }
        Ok(())
      },
      monitor_state,
    ))
  }
}
