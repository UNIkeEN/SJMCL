use crate::error::{SJMCLError, SJMCLResult};
use crate::launcher_config::commands::retrieve_launcher_config;
use crate::tasks::*;
use futures::stream::TryStreamExt;
use governor::{prelude::StreamRateLimitExt, DefaultDirectRateLimiter};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::future::Future;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Manager, Url};
use tauri_plugin_http::reqwest;
use tauri_plugin_http::reqwest::header::RANGE;
use tokio::io::AsyncSeekExt;
use tokio_util::{bytes, compat::FuturesAsyncReadCompatExt};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DownloadParam {
  src: Url,
  dest: PathBuf,
  sha1: String,
}

pub struct DownloadTask {
  app_handle: AppHandle,
  desc: ProgressiveTaskDescriptor,
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
      app_handle,
      desc: ProgressiveTaskDescriptor::new(
        task_id,
        task_group,
        ProgressiveTaskType::Download,
        0,
        cache_dir.clone(),
        ProgressiveTaskParam::Download(param.clone()),
        ProgressState::InProgress,
      ),
      param: param.clone(),
      dest_path: cache_dir.clone().join(param.dest.clone()),
      report_interval,
    }
  }

  pub fn from_descriptor(
    app_handle: AppHandle,
    desc: &ProgressiveTaskDescriptor,
    report_interval: Duration,
  ) -> Self {
    DownloadTask {
      app_handle,
      desc: ProgressiveTaskDescriptor {
        state: ProgressState::Stopped,
        ..desc.clone()
      },
      param: match &desc.task_param {
        ProgressiveTaskParam::Download(param) => param.clone(),
      },
      dest_path: desc.store_path.clone(),
      report_interval,
    }
  }

  async fn create_resp(
    app_handle: &AppHandle,
    desc: &mut ProgressiveTaskDescriptor,
    param: &DownloadParam,
  ) -> SJMCLResult<impl Stream<Item = Result<bytes::Bytes, std::io::Error>>> {
    let client = app_handle.state::<reqwest::Client>().clone();
    Ok(
      if desc.total == 0 && desc.current == 0 {
        let r = client
          .get(param.src.clone())
          .send()
          .await?
          .error_for_status()?;
        desc.total = r.content_length().unwrap_or_default() as i64;
        desc.save()?;
        r
      } else {
        client
          .get(param.src.clone())
          .header(RANGE, format!("bytes={}-", desc.current))
          .send()
          .await?
          .error_for_status()?
      }
      .bytes_stream()
      .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e)),
    )
  }

  fn validate_sha1(&self) -> SJMCLResult<()> {
    let mut f = std::fs::File::options()
      .read(true)
      .create(false)
      .write(false)
      .open(&self.dest_path)
      .unwrap();
    let mut hasher = Sha1::new();
    std::io::copy(&mut f, &mut hasher).unwrap();
    let sha1 = hex::encode(hasher.finalize());
    if sha1 != self.param.sha1 {
      Err(SJMCLError(format!(
        "SHA1 mismatch for {}: expected {}, got {}",
        self.dest_path.display(),
        self.param.sha1,
        sha1
      )))
    } else {
      Ok(())
    }
  }
  async fn future_impl(
    self,
    resp: impl Stream<Item = Result<bytes::Bytes, std::io::Error>> + Send + Unpin,
  ) -> SJMCLResult<(
    impl Future<Output = SJMCLResult<()>> + Send,
    Arc<Mutex<ProgressiveTaskDescriptor>>,
  )> {
    let stream = ProgressStream::new(
      self.app_handle.clone(),
      resp,
      self.desc.clone(),
      self.report_interval,
    );

    let start_desc = self.desc.clone();
    let descriptor = stream.descriptor();
    let stream_desc = descriptor.clone();

    Ok((
      async move {
        let handle = self.app_handle.clone();
        tokio::fs::create_dir_all(&self.dest_path.parent().unwrap()).await?;
        let mut file = if start_desc.current == 0 {
          tokio::fs::File::create(&self.dest_path).await?
        } else {
          let mut f = tokio::fs::OpenOptions::new().open(&self.dest_path).await?;
          f.seek(std::io::SeekFrom::Start(start_desc.current as u64))
            .await?;
          f
        };
        ProgressiveTaskEvent::emit_started(
          &handle,
          start_desc.task_id,
          start_desc.task_group.as_deref(),
          start_desc.total,
        );
        tokio::io::copy(&mut stream.into_async_read().compat(), &mut file).await?;
        drop(file);
        if stream_desc.lock().unwrap().is_cancelled() {
          tokio::fs::remove_file(&self.dest_path).await?;
          Ok(())
        } else {
          self.validate_sha1()
        }
      },
      descriptor,
    ))
  }

  pub async fn future_with_ratelimiter(
    mut self,
    lim: &'_ DefaultDirectRateLimiter,
  ) -> SJMCLResult<(
    impl Future<Output = SJMCLResult<()>> + Send + '_,
    Arc<Mutex<ProgressiveTaskDescriptor>>,
  )> {
    let resp = Self::create_resp(&self.app_handle, &mut self.desc, &self.param)
      .await?
      .ratelimit_stream(lim);
    Self::future_impl(self, resp).await
  }

  pub async fn future(
    mut self,
  ) -> SJMCLResult<(
    impl Future<Output = SJMCLResult<()>> + Sync,
    Arc<Mutex<ProgressiveTaskDescriptor>>,
  )> {
    let resp = Self::create_resp(&self.app_handle, &mut self.desc, &self.param).await?;
    Self::future_impl(self, resp).await
  }
}
