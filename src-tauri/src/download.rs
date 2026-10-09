use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures::future::join_all;
use sjmcl_downloader::download::DownloadExecutor;
use sjmcl_downloader::{
  EngineConfig, EngineError, EngineHandle, EngineSetup, GroupState, SubmitGroup, SubmitTask,
  TaskExecutor, TokenBucket,
};
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use tauri::{AppHandle, Manager, Url};

use crate::APP_DATA_DIR;
use crate::instance::helpers::loader::common::InstallPlan;
use crate::instance::helpers::loader::postprocess::{
  InstallKind, InstallSpec, InstallTarget, PrepareSpec,
};
use crate::instance::models::misc::Instance;
use crate::launcher_config::models::LauncherConfig;
use crate::resource::helpers::curseforge::misc::{
  CURSEFORGE_API_KEY, is_curseforge_authenticated_url,
};
use crate::utils::fs::is_local_file_valid;
use crate::utils::web::build_sjmcl_client;

pub fn init_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
  sjmcl_downloader::init_with_setup(|app| {
    let launcher_config = app.state::<Mutex<LauncherConfig>>();
    let launcher_config = launcher_config.lock().map_err(|error| error.to_string())?;
    let download_concurrency = if launcher_config.download.transmission.auto_concurrent {
      std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1)
    } else {
      launcher_config
        .download
        .transmission
        .concurrent_count
        .max(1)
    };
    let speed_limit = launcher_config
      .download
      .transmission
      .enable_speed_limit
      .then_some(
        (launcher_config.download.transmission.speed_limit_value as u64).saturating_mul(1024),
      );
    drop(launcher_config);

    let client = build_sjmcl_client(app, true);
    let executor = DownloadExecutor {
      client: client.clone(),
      limiter: speed_limit
        .map(|bytes_per_second| Arc::new(TokenBucket::new(bytes_per_second, bytes_per_second))),
      request_decorator: Some(Arc::new(
        |raw_url: &str, request: tauri_plugin_http::reqwest::RequestBuilder| {
          if raw_url
            .parse()
            .is_ok_and(|url| is_curseforge_authenticated_url(&url))
          {
            request.header("x-api-key", CURSEFORGE_API_KEY.as_str())
          } else {
            request
          }
        },
      )),
      ..DownloadExecutor::default()
    };
    app.manage(client);

    Ok(EngineSetup {
      db_path: APP_DATA_DIR
        .get()
        .ok_or_else(|| "APP_DATA_DIR is not initialized".to_string())?
        .join("downloads.db"),
      config: EngineConfig {
        concurrency: download_concurrency,
        ..EngineConfig::default()
      },
      executor,
      extra_executors: vec![
        Arc::new(
          crate::instance::helpers::loader::postprocess::PrepareExecutor { app: app.clone() },
        ) as Arc<dyn TaskExecutor>,
        Arc::new(
          crate::instance::helpers::loader::postprocess::InstallExecutor { app: app.clone() },
        ) as Arc<dyn TaskExecutor>,
        Arc::new(crate::instance::helpers::loader::postprocess::VerifyExecutor { app: app.clone() })
          as Arc<dyn TaskExecutor>,
      ],
    })
  })
}

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

pub async fn get_invalid_download_tasks(
  tasks: Vec<DownloadTask>,
  check_hash: bool,
) -> SJMCLResult<Vec<DownloadTask>> {
  let results = join_all(tasks.into_iter().map(|task| async move {
    let valid = is_local_file_valid(&task.dest, task.sha1.as_deref(), check_hash).await?;
    Ok::<_, SJMCLError>((!valid).then_some(task))
  }))
  .await;

  let mut tasks = Vec::new();
  for result in results {
    if let Some(task) = result? {
      tasks.push(task);
    }
  }
  Ok(tasks)
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
  plan: InstallPlan,
  instance: &Instance,
  kind: InstallKind,
) -> SJMCLResult<String> {
  let mut tasks: Vec<SubmitTask> = get_invalid_download_tasks(plan.tasks, false)
    .await?
    .into_iter()
    .map(Into::into)
    .collect();
  let target = InstallTarget {
    instance_id: instance.id.clone(),
    version_path: instance.version_path.clone(),
    kind,
  };
  let verify_spec = serde_json::to_value(&target)?;
  let install_spec = serde_json::to_value(InstallSpec {
    target,
    processors: plan.processors,
  })?;
  tasks.push(SubmitTask {
    name: "Install".into(),
    executor: "install".into(),
    spec: install_spec,
    dest: None,
    sha1: None,
    sha256: None,
  });
  tasks.push(SubmitTask {
    name: "Verify".into(),
    executor: "verify".into(),
    spec: verify_spec,
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
