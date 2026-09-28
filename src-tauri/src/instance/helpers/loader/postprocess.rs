use std::collections::HashMap;
use std::fs::File;
use std::io;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use sjmcl_downloader::EngineHandle;
use sjmcl_downloader::executor::BoxFuture;
use sjmcl_downloader::{ExecContext, TaskError, TaskExecutor, TaskOutcome, TaskReport};
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use sjmcl_types::storage::load_json_async;
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

use crate::instance::helpers::client_json::McClientInfo;
use crate::instance::helpers::loader::common::execute_processors;
use crate::instance::helpers::loader::forge::InstallProfile;
use crate::instance::helpers::loader::optifine::finish_optifine_install;
use crate::instance::helpers::misc::{InstanceRefreshLock, prepare_instance_after_download};
use crate::instance::models::misc::{Instance, ModLoaderStatus};

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallKind {
  ModLoader,
  Optifine,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSpec {
  pub instance_id: String,
  pub version_path: PathBuf,
  pub kind: InstallKind,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareSpec {
  pub instance_id: String,
  pub version_path: PathBuf,
}

pub struct PrepareExecutor {
  pub app: AppHandle,
}

impl TaskExecutor for PrepareExecutor {
  fn name(&self) -> &'static str {
    "prepare_install"
  }

  fn postprocess_order(&self) -> u32 {
    1
  }

  fn run(&self, ctx: ExecContext) -> BoxFuture<'static, Result<(), TaskError>> {
    let app = self.app.clone();
    Box::pin(async move {
      if ctx.run_token.is_cancelled() {
        report_interrupted(&ctx).await;
        return Ok(());
      }
      let spec: PrepareSpec = serde_json::from_value(ctx.spec.clone())
        .map_err(|error| TaskError::Other(error.to_string()))?;
      if let Err(error) =
        prepare_instance_after_download(&app, &spec.instance_id, &spec.version_path).await
      {
        if let Err(corrupt @ TaskError::CorruptFiles(_)) =
          verify_downloads(&app, &ctx.group_id).await
        {
          return Err(corrupt);
        }
        return Err(TaskError::Other(error.0));
      }
      ctx
        .report
        .send(TaskReport::Outcome {
          task_id: ctx.task_id,
          outcome: TaskOutcome::Done { verified: false },
        })
        .await
        .map_err(|error| TaskError::Other(error.to_string()))
    })
  }
}

pub struct InstallExecutor {
  pub app: AppHandle,
}

pub struct VerifyExecutor {
  pub app: AppHandle,
}

async fn verify_downloads(app: &AppHandle, group_id: &str) -> Result<(), TaskError> {
  let mut engine = app.try_state::<EngineHandle>();
  for _ in 0..100 {
    if engine.is_some() {
      break;
    }
    tokio::time::sleep(Duration::from_millis(10)).await;
    engine = app.try_state::<EngineHandle>();
  }
  let tasks = engine
    .ok_or_else(|| TaskError::Other("download engine is not initialized".into()))?
    .0
    .list_tasks(group_id.to_string())
    .await
    .map_err(|error| TaskError::Other(error.to_string()))?;
  tokio::task::spawn_blocking(move || {
    let mut corrupt = Vec::new();
    for task in tasks.iter().filter(|task| task.executor == "download") {
      let Some(path) = task.dest.as_ref() else {
        continue;
      };
      match File::open(path) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
          corrupt.push(path.clone());
        }
        Err(error) => return Err(TaskError::Io(error.to_string())),
        Ok(mut file) => {
          if let Some(expected) = task.sha1.as_ref() {
            let mut hasher = Sha1::new();
            io::copy(&mut file, &mut hasher).map_err(|error| TaskError::Io(error.to_string()))?;
            if hex::encode(hasher.finalize()) != *expected {
              corrupt.push(path.clone());
            }
          } else if path.extension().is_some_and(|extension| extension == "jar") {
            let valid = ZipArchive::new(file).is_ok_and(|mut archive| {
              (0..archive.len()).all(|index| {
                archive
                  .by_index(index)
                  .is_ok_and(|mut entry| io::copy(&mut entry, &mut io::sink()).is_ok())
              })
            });
            if !valid {
              corrupt.push(path.clone());
            }
          }
        }
      }
    }
    if corrupt.is_empty() {
      Ok(())
    } else {
      Err(TaskError::CorruptFiles(corrupt))
    }
  })
  .await
  .map_err(|error| TaskError::Other(error.to_string()))?
}

impl TaskExecutor for VerifyExecutor {
  fn name(&self) -> &'static str {
    "verify"
  }

  fn postprocess_order(&self) -> u32 {
    2
  }

  fn run(&self, ctx: ExecContext) -> BoxFuture<'static, Result<(), TaskError>> {
    let app = self.app.clone();
    Box::pin(async move {
      if ctx.run_token.is_cancelled() {
        report_interrupted(&ctx).await;
        return Ok(());
      }
      let spec: InstallSpec = serde_json::from_value(ctx.spec.clone())
        .map_err(|error| TaskError::Other(error.to_string()))?;
      let checked = verify_downloads(&app, &ctx.group_id).await;
      let mut instance = Instance {
        version_path: spec.version_path,
        ..Default::default()
      }
      .load_json_cfg()
      .await
      .map_err(|error| TaskError::Io(error.to_string()))?;
      if instance.id != spec.instance_id {
        return Err(TaskError::Other(
          "installation instance does not match task".into(),
        ));
      }
      if let Err(error) = checked {
        if let Err(save_error) = save_status(
          &app,
          &mut instance,
          spec.kind,
          ModLoaderStatus::DownloadFailed,
        )
        .await
        {
          log::warn!("Failed to save install failure status: {:?}", save_error);
        }
        return Err(error);
      }
      save_status(&app, &mut instance, spec.kind, ModLoaderStatus::Installed)
        .await
        .map_err(|error| TaskError::Other(error.0))?;
      ctx
        .report
        .send(TaskReport::Outcome {
          task_id: ctx.task_id,
          outcome: TaskOutcome::Done { verified: false },
        })
        .await
        .map_err(|error| TaskError::Other(error.to_string()))
    })
  }
}

impl TaskExecutor for InstallExecutor {
  fn name(&self) -> &'static str {
    "install"
  }

  fn postprocess_order(&self) -> u32 {
    1
  }

  fn run(&self, ctx: ExecContext) -> BoxFuture<'static, Result<(), TaskError>> {
    let app = self.app.clone();
    Box::pin(async move {
      if ctx.run_token.is_cancelled() {
        report_interrupted(&ctx).await;
        return Ok(());
      }
      let spec: InstallSpec = serde_json::from_value(ctx.spec.clone())
        .map_err(|error| TaskError::Other(error.to_string()))?;
      if let Err(error) = install(&app, spec).await {
        if let Err(corrupt @ TaskError::CorruptFiles(_)) =
          verify_downloads(&app, &ctx.group_id).await
        {
          return Err(corrupt);
        }
        return Err(TaskError::Other(error.0));
      }
      ctx
        .report
        .send(TaskReport::Outcome {
          task_id: ctx.task_id,
          outcome: TaskOutcome::Done { verified: false },
        })
        .await
        .map_err(|error| TaskError::Other(error.to_string()))
    })
  }
}

async fn report_interrupted(ctx: &ExecContext) {
  let _ = ctx
    .report
    .send(TaskReport::Outcome {
      task_id: ctx.task_id.clone(),
      outcome: TaskOutcome::Interrupted { offset: 0 },
    })
    .await;
}

async fn save_status(
  app: &AppHandle,
  instance: &mut Instance,
  kind: InstallKind,
  status: ModLoaderStatus,
) -> SJMCLResult<()> {
  let binding = app.state::<InstanceRefreshLock>();
  let _refresh_guard = binding.0.lock().await;
  let mut latest = instance.load_json_cfg().await?;
  if latest.id != instance.id || latest.version_path != instance.version_path {
    return Err(SJMCLError(
      "installation instance does not match task".into(),
    ));
  }
  match kind {
    InstallKind::ModLoader => {
      if latest.mod_loader.loader_type != instance.mod_loader.loader_type
        || latest.mod_loader.version != instance.mod_loader.version
      {
        return Err(SJMCLError("mod loader changed during installation".into()));
      }
      latest.mod_loader.status = status.clone();
    }
    InstallKind::Optifine => {
      let optifine = latest
        .optifine
        .as_mut()
        .ok_or_else(|| SJMCLError("OptiFine is missing".into()))?;
      if instance.optifine.as_ref().map(|old| &old.filename) != Some(&optifine.filename) {
        return Err(SJMCLError("OptiFine changed during installation".into()));
      }
      optifine.status = status.clone();
    }
  }
  latest.save_json_cfg().await?;
  let binding = app.state::<Mutex<HashMap<String, Instance>>>();
  let mut instances = binding.lock()?;
  if let Some(current) = instances.get_mut(&instance.id)
    && current.version_path == instance.version_path
  {
    match kind {
      InstallKind::ModLoader
        if current.mod_loader.loader_type == latest.mod_loader.loader_type
          && current.mod_loader.version == latest.mod_loader.version =>
      {
        current.mod_loader.status = status;
      }
      InstallKind::Optifine
        if current.optifine.as_ref().map(|optifine| &optifine.filename)
          == latest.optifine.as_ref().map(|optifine| &optifine.filename) =>
      {
        current.optifine.as_mut().unwrap().status = status;
      }
      _ => {}
    }
  }
  *instance = latest;
  Ok(())
}

async fn install(app: &AppHandle, spec: InstallSpec) -> SJMCLResult<()> {
  let mut instance = Instance {
    version_path: spec.version_path,
    ..Default::default()
  }
  .load_json_cfg()
  .await?;
  if instance.id != spec.instance_id {
    return Err(SJMCLError(
      "installation instance does not match task".into(),
    ));
  }
  let status = match spec.kind {
    InstallKind::ModLoader => &instance.mod_loader.status,
    InstallKind::Optifine => {
      &instance
        .optifine
        .as_ref()
        .ok_or_else(|| SJMCLError("OptiFine is missing".into()))?
        .status
    }
  };
  if *status == ModLoaderStatus::Installed {
    return Ok(());
  }
  save_status(app, &mut instance, spec.kind, ModLoaderStatus::Installing).await?;
  let result = async {
    let client_info: McClientInfo = load_json_async(
      &instance
        .version_path
        .join(format!("{}.json", instance.name)),
    )
    .await?;
    match spec.kind {
      InstallKind::ModLoader => {
        let profile_path = instance.version_path.join("install_profile.json");
        if profile_path.exists() {
          let profile: InstallProfile = load_json_async(&profile_path).await?;
          execute_processors(app, &instance, &client_info, &profile).await?;
        }
      }
      InstallKind::Optifine => finish_optifine_install(app, &instance, &client_info).await?,
    }
    Ok::<(), SJMCLError>(())
  }
  .await;
  match result {
    Ok(()) => Ok(()),
    Err(error) => {
      save_status(
        app,
        &mut instance,
        spec.kind,
        ModLoaderStatus::DownloadFailed,
      )
      .await?;
      Err(error)
    }
  }
}
