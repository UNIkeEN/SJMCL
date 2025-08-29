use crate::launcher_config::commands::retrieve_launcher_config;
use crate::utils::fs::validate_sha1;
use crate::utils::web::with_retry;

use super::monitor::{RuntimeGroupStateRwLock, RuntimeTaskDescRwLock, RuntimeTaskProgressReader};
use super::reporter::TaskReporter;

use async_speed_limit::{clock::StandardClock, Limiter};
use futures::stream::{Stream, TryStreamExt};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Url};
use tauri_plugin_http::reqwest;
use tauri_plugin_http::reqwest::header::RANGE;
use tokio::io::AsyncSeekExt;
use tokio_util::{bytes, compat::FuturesAsyncReadCompatExt};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadParam {
  pub src: Url,
  pub dest: PathBuf,
  pub sha1: Option<String>,
  pub filename: Option<String>,
}

async fn send_request(
  app_handle: &AppHandle,
  current: i64,
  param: &DownloadParam,
) -> std::io::Result<reqwest::Response> {
  let state = app_handle.state::<reqwest::Client>();
  let client = with_retry(state.inner().clone());
  let request = if current == 0 {
    client.get(param.src.clone())
  } else {
    client
      .get(param.src.clone())
      .header(RANGE, format!("bytes={current}-"))
  };
  let response = request.send().await.map_err(std::io::Error::other)?;
  let response = response.error_for_status().map_err(std::io::Error::other)?;
  Ok(response)
}

async fn create_resp_stream(
  app_handle: &AppHandle,
  current: i64,
  param: &DownloadParam,
) -> std::io::Result<(
  impl Stream<Item = Result<bytes::Bytes, std::io::Error>> + Send,
  i64,
)> {
  let resp = send_request(app_handle, current, param).await?;
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

pub fn into_runtime_task<'a>(
  app_handle: AppHandle,
  group_state: RuntimeGroupStateRwLock,
  task_desc: RuntimeTaskDescRwLock,
  param: DownloadParam,
  reporter: &'a mut TaskReporter,
) -> impl Future<Output = std::io::Result<()>> + Send + 'a {
  let download_path = retrieve_launcher_config(app_handle.clone())
    .unwrap()
    .download
    .cache
    .directory
    .clone();

  let lim = app_handle
    .state::<Option<Limiter<StandardClock>>>()
    .as_ref()
    .cloned();
  let dest_path = download_path.join(param.dest.clone());

  async move {
    let current = task_desc.read().unwrap().current;
    let (resp, total_progress) = create_resp_stream(&app_handle, current as i64, &param).await?;
    {
      let mut task_desc = task_desc.write().unwrap();
      task_desc.total = total_progress as u64;
      task_desc.state.set_in_progress();
      task_desc.save().unwrap();
      reporter.report_started(total_progress);
    }
    tokio::fs::create_dir_all(&dest_path.parent().unwrap()).await?;
    let mut file = if current == 0 {
      tokio::fs::File::create(&dest_path).await?
    } else {
      let mut f = tokio::fs::OpenOptions::new().open(&dest_path).await?;
      f.seek(std::io::SeekFrom::Start(current)).await?;
      f
    };
    let result = if let Some(lim) = lim {
      let mut reader = RuntimeTaskProgressReader::new(
        lim.limit(resp.into_async_read()).compat(),
        group_state,
        task_desc.clone(),
        reporter,
      );
      tokio::io::copy(&mut reader, &mut file).await
    } else {
      let mut reader = RuntimeTaskProgressReader::new(
        resp.into_async_read().compat(),
        group_state,
        task_desc.clone(),
        reporter,
      );
      tokio::io::copy(&mut reader, &mut file).await
    }
    .map(|_| ());
    drop(file);

    if task_desc.read().unwrap().state.is_cancelled() {
      tokio::fs::remove_file(&dest_path).await?;
    }

    if result.is_ok() {
      match param.sha1 {
        Some(truth) => validate_sha1(dest_path, truth).map_err(|e| std::io::Error::other(e.0)),
        None => Ok(()),
      }
    } else {
      result
    }
  }
}
