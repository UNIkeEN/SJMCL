use std::path::PathBuf;
use std::time::Duration;

use sjmcl_downloader::{EngineError, EngineHandle, GroupState, SubmitGroup, SubmitTask};
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use tauri::{AppHandle, Manager, Url};

use crate::instance::helpers::loader::postprocess::{InstallKind, InstallSpec, PrepareSpec};
use crate::instance::models::misc::Instance;

#[derive(Debug, Clone)]
pub struct DownloadTask {
  pub src: Url,
  pub dest: PathBuf,
  pub filename: Option<String>,
  pub sha1: Option<String>,
}

impl From<DownloadTask> for SubmitTask {
  fn from(task: DownloadTask) -> Self {
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
  tasks: Vec<DownloadTask>,
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

pub async fn submit_instance_download_group(
  app: AppHandle,
  name: String,
  tasks: Vec<DownloadTask>,
  instance: &Instance,
) -> SJMCLResult<String> {
  let mut tasks: Vec<SubmitTask> = tasks.into_iter().map(Into::into).collect();
  tasks.push(SubmitTask {
    name: "Prepare installation".into(),
    executor: "prepare_install".into(),
    spec: serde_json::to_value(PrepareSpec {
      instance_id: instance.id.clone(),
      version_path: instance.version_path.clone(),
    })?,
    dest: None,
    sha1: None,
    sha256: None,
  });
  app
    .state::<EngineHandle>()
    .0
    .submit_group(SubmitGroup {
      name,
      tasks,
      auto_resume: true,
    })
    .await
    .map_err(engine_error)
}

pub async fn submit_install_group(
  app: AppHandle,
  name: String,
  tasks: Vec<DownloadTask>,
  instance: &Instance,
  kind: InstallKind,
) -> SJMCLResult<String> {
  let mut tasks: Vec<SubmitTask> = tasks.into_iter().map(Into::into).collect();
  let spec = serde_json::to_value(InstallSpec {
    instance_id: instance.id.clone(),
    version_path: instance.version_path.clone(),
    kind,
  })?;
  tasks.push(SubmitTask {
    name: "Install".into(),
    executor: "install".into(),
    spec: spec.clone(),
    dest: None,
    sha1: None,
    sha256: None,
  });
  tasks.push(SubmitTask {
    name: "Verify".into(),
    executor: "verify".into(),
    spec,
    dest: None,
    sha1: None,
    sha256: None,
  });
  let mut engine = app.try_state::<EngineHandle>();
  for _ in 0..100 {
    if engine.is_some() {
      break;
    }
    tokio::time::sleep(Duration::from_millis(10)).await;
    engine = app.try_state::<EngineHandle>();
  }
  engine
    .ok_or_else(|| SJMCLError("download engine is not initialized".into()))?
    .0
    .submit_group(SubmitGroup {
      name,
      tasks,
      auto_resume: true,
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
