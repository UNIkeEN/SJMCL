use std::path::PathBuf;

use sjmcl_downloader::{EngineError, EngineHandle, GroupState, SubmitGroup, SubmitTask};
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use tauri::{AppHandle, Manager, Url};

#[derive(Debug, Clone)]
pub struct DownloadTask {
  pub src: Url,
  pub dest: PathBuf,
  pub filename: Option<String>,
  pub sha1: Option<String>,
}

pub type DownloadParam = DownloadTask;

#[derive(Debug, Clone)]
pub enum PTaskParam {
  Download(DownloadTask),
}

impl From<PTaskParam> for SubmitTask {
  fn from(task: PTaskParam) -> Self {
    let PTaskParam::Download(task) = task;
    let name = task.filename.unwrap_or_else(|| {
      task
        .dest
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| task.dest.to_string_lossy().into_owned())
    });
    Self {
      name,
      executor: "download".into(),
      spec: serde_json::json!({ "url": task.src }),
      dest: Some(task.dest),
      sha1: task.sha1,
      sha256: None,
    }
  }
}

pub async fn submit_download_group(
  app: AppHandle,
  name: String,
  tasks: Vec<PTaskParam>,
  auto_resume: bool,
) -> SJMCLResult<String> {
  let engine = app.state::<EngineHandle>();
  engine
    .0
    .submit_group(SubmitGroup {
      name,
      tasks: tasks.into_iter().map(Into::into).collect(),
      auto_resume,
    })
    .await
    .map_err(engine_error)
}

pub async fn has_active_downloads(app: &AppHandle) -> SJMCLResult<bool> {
  app
    .state::<EngineHandle>()
    .0
    .snapshot()
    .await
    .map(|groups| {
      groups
        .iter()
        .any(|group| group.state != GroupState::Finished)
    })
    .map_err(engine_error)
}

fn engine_error(error: EngineError) -> SJMCLError {
  SJMCLError(error.to_string())
}
