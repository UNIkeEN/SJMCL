use std::collections::HashMap;
use std::fs::File;
use std::io;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use sjmcl_downloader::executor::BoxFuture;
use sjmcl_downloader::{
  EngineError, EngineHandle, ExecContext, TaskError, TaskExecutor, TaskOutcome, TaskReport,
  TaskState,
};
use sjmcl_types::storage::{load_json_async, save_json_async};
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

use crate::download::{submit_install_group, task_error};
use crate::instance::helpers::client_json::{
  McClientInfo, remove_mod_loader_from_client_info, remove_optifine_from_client_info,
};
use crate::instance::helpers::loader::cleanroom::download_cleanroom_libraries;
use crate::instance::helpers::loader::common::{InstallPlan, execute_processors};
use crate::instance::helpers::loader::forge::{ProcessorsValue, download_forge_libraries};
use crate::instance::helpers::loader::neoforge::download_neoforge_libraries;
use crate::instance::helpers::loader::optifine::{
  download_optifine_libraries, finish_optifine_install,
};
use crate::instance::helpers::misc::InstanceRefreshLock;
use crate::instance::models::misc::{Instance, InstanceError, ModLoaderStatus, ModLoaderType};
use crate::launcher_config::helpers::java::refresh_and_update_javas;
use crate::launcher_config::models::LauncherConfig;
use crate::resource::helpers::misc::get_source_priority_list;

#[derive(Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallKind {
  ModLoader,
  Optifine,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSpec {
  #[serde(flatten)]
  pub target: InstallTarget,
  pub processors: Vec<ProcessorsValue>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallTarget {
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
      let spec: PrepareSpec = serde_json::from_value(ctx.spec.clone())?;
      // Java files in this group are complete before preparing child installation groups.
      if !refresh_java_for_task(&app, &ctx).await? {
        return Ok(());
      }
      if let Err(error) = prepare_installation(&app, spec, &ctx.group_id).await {
        if let Err(corrupt @ TaskError::CorruptFiles { .. }) =
          verify_downloads(&app, &ctx.group_id, true).await
        {
          return Err(corrupt);
        }
        return Err(error);
      }
      ctx
        .report
        .send(TaskReport::Outcome {
          task_id: ctx.task_id,
          outcome: TaskOutcome::Done { verified: false },
        })
        .await
        .map_err(|error| TaskError::Other {
          details: error.to_string(),
        })
    })
  }
}

async fn prepare_installation(
  app: &AppHandle,
  spec: PrepareSpec,
  group_id: &str,
) -> Result<(), TaskError> {
  let binding = app.state::<InstanceRefreshLock>();
  let _refresh_guard = binding.0.lock().await;
  let mut instance = Instance {
    version_path: spec.version_path,
    ..Default::default()
  }
  .load_json_cfg()
  .await?;
  if instance.id != spec.instance_id {
    return Err(InstanceError::InstallationInstanceMismatch.into());
  }
  let json_path = instance
    .version_path
    .join(format!("{}.json", instance.name));
  let mut client_info: McClientInfo = load_json_async(&json_path).await?;
  let priority_list = {
    let binding = app.state::<Mutex<LauncherConfig>>();
    let config = binding.lock().map_err(|error| TaskError::Other {
      details: error.to_string(),
    })?;
    get_source_priority_list(&config)
  };
  let engine = app
    .try_state::<EngineHandle>()
    .ok_or(EngineError::EngineNotInitialized)?;
  let submitted_groups = engine.0.snapshot().await?;
  let mut submitted_kinds = Vec::new();
  for group in submitted_groups
    .iter()
    .filter(|group| group.parent_group_id.as_deref() == Some(group_id))
  {
    let tasks = engine.0.list_tasks(group.id.clone()).await?;
    if let Some(task) = tasks.into_iter().find(|task| task.executor == "install") {
      let target: InstallTarget = serde_json::from_value(task.spec)?;
      submitted_kinds.push(target.kind);
    }
  }
  let mut install_groups: Vec<(String, InstallPlan, InstallKind)> = Vec::new();

  let kind = instance.mod_loader.loader_type;
  // The parent ID distinguishes retries from other installations of the same instance.
  let loader_group_name = format!(
    "{}-libraries?{}@{}",
    kind.to_string().to_lowercase(),
    instance.id,
    group_id
  );
  if matches!(
    instance.mod_loader.status,
    ModLoaderStatus::NotDownloaded | ModLoaderStatus::Downloading
  ) && matches!(
    kind,
    ModLoaderType::Forge | ModLoaderType::Cleanroom | ModLoaderType::NeoForge
  ) && !submitted_kinds.contains(&InstallKind::ModLoader)
  {
    instance.mod_loader.status = ModLoaderStatus::Downloading;
    // A previous preparation may have saved this patch before submission failed.
    remove_mod_loader_from_client_info(&mut client_info, kind);
    let plan = match kind {
      ModLoaderType::Forge => {
        download_forge_libraries(app, &priority_list, &instance, &mut client_info)
          .await
          .map_err(task_error)?
      }
      ModLoaderType::Cleanroom => {
        download_cleanroom_libraries(app, &priority_list, &instance, &mut client_info)
          .await
          .map_err(task_error)?
      }
      ModLoaderType::NeoForge => {
        download_neoforge_libraries(app, &priority_list, &instance, &mut client_info)
          .await
          .map_err(task_error)?
      }
      _ => unreachable!(),
    };
    install_groups.push((loader_group_name, plan, InstallKind::ModLoader));
  }

  let optifine_group_name = format!("optifine-libraries?{}@{}", instance.id, group_id);
  if instance.optifine.as_ref().is_some_and(|optifine| {
    matches!(
      optifine.status,
      ModLoaderStatus::NotDownloaded | ModLoaderStatus::Downloading
    )
  }) && !submitted_kinds.contains(&InstallKind::Optifine)
  {
    instance.optifine.as_mut().unwrap().status = ModLoaderStatus::Downloading;
    if client_info
      .patches
      .iter()
      .any(|patch| patch.id == "optifine")
    {
      remove_optifine_from_client_info(&mut client_info);
    }
    let tasks = download_optifine_libraries(app, &priority_list, &instance, &mut client_info)
      .await
      .map_err(task_error)?;
    install_groups.push((
      optifine_group_name,
      InstallPlan {
        tasks,
        processors: Vec::new(),
      },
      InstallKind::Optifine,
    ));
  }

  if !install_groups.is_empty() {
    // Persist installation metadata before submitted tasks can start.
    save_json_async(&client_info, &json_path).await?;
    instance.save_json_cfg().await?;
    for (name, plan, kind) in install_groups {
      submit_install_group(app.clone(), name, plan, &instance, kind, group_id).await?;
    }
  }
  Ok(())
}

pub struct InstallExecutor {
  pub app: AppHandle,
}

pub struct VerifyExecutor {
  pub app: AppHandle,
}

async fn verify_downloads(
  app: &AppHandle,
  group_id: &str,
  recheck_verified: bool,
) -> Result<(), TaskError> {
  let tasks = app
    .try_state::<EngineHandle>()
    .ok_or(EngineError::EngineNotInitialized)?
    .0
    .list_tasks(group_id.to_string())
    .await?;
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
        Err(error) => {
          return Err(error.into());
        }
        Ok(mut file) => {
          // Downloads with checksums were already verified before installation.
          if !recheck_verified && task.state == TaskState::Done && task.verified {
            continue;
          }
          if let Some(expected) = task.sha1.as_ref() {
            let mut hasher = Sha1::new();
            io::copy(&mut file, &mut hasher)?;
            if !hex::encode(hasher.finalize()).eq_ignore_ascii_case(expected) {
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
      Err(TaskError::CorruptFiles { paths: corrupt })
    }
  })
  .await
  .map_err(|error| TaskError::Other {
    details: error.to_string(),
  })?
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
      let spec: InstallTarget = serde_json::from_value(ctx.spec.clone())?;
      let checked = verify_downloads(&app, &ctx.group_id, false).await;
      let mut instance = Instance {
        version_path: spec.version_path,
        ..Default::default()
      }
      .load_json_cfg()
      .await?;
      if instance.id != spec.instance_id {
        return Err(InstanceError::InstallationInstanceMismatch.into());
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
      save_status(&app, &mut instance, spec.kind, ModLoaderStatus::Installed).await?;
      ctx
        .report
        .send(TaskReport::Outcome {
          task_id: ctx.task_id,
          outcome: TaskOutcome::Done { verified: false },
        })
        .await
        .map_err(|error| TaskError::Other {
          details: error.to_string(),
        })
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
      let spec: InstallSpec = serde_json::from_value(ctx.spec.clone())?;
      if !refresh_java_for_task(&app, &ctx).await? {
        return Ok(());
      }
      if let Err(error) = install(&app, spec).await {
        if let Err(corrupt @ TaskError::CorruptFiles { .. }) =
          verify_downloads(&app, &ctx.group_id, true).await
        {
          return Err(corrupt);
        }
        return Err(error);
      }
      ctx
        .report
        .send(TaskReport::Outcome {
          task_id: ctx.task_id,
          outcome: TaskOutcome::Done { verified: false },
        })
        .await
        .map_err(|error| TaskError::Other {
          details: error.to_string(),
        })
    })
  }
}

async fn refresh_java_for_task(app: &AppHandle, ctx: &ExecContext) -> Result<bool, TaskError> {
  tokio::select! {
    biased;
    _ = ctx.run_token.cancelled() => {
      report_interrupted(ctx).await;
      Ok(false)
    }
    result = refresh_and_update_javas(app) => result.map(|()| true).map_err(task_error),
  }
}

pub struct RefreshJavaExecutor {
  pub app: AppHandle,
}

impl TaskExecutor for RefreshJavaExecutor {
  fn name(&self) -> &'static str {
    "refresh_java"
  }

  fn postprocess_order(&self) -> u32 {
    1
  }

  fn run(&self, ctx: ExecContext) -> BoxFuture<'static, Result<(), TaskError>> {
    let app = self.app.clone();
    Box::pin(async move {
      if !refresh_java_for_task(&app, &ctx).await? {
        return Ok(());
      }
      ctx
        .report
        .send(TaskReport::Outcome {
          task_id: ctx.task_id,
          outcome: TaskOutcome::Done { verified: false },
        })
        .await
        .map_err(|error| TaskError::Other {
          details: error.to_string(),
        })
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
) -> Result<(), TaskError> {
  let binding = app.state::<InstanceRefreshLock>();
  let _refresh_guard = binding.0.lock().await;
  let mut latest = instance.load_json_cfg().await?;
  if latest.id != instance.id || latest.version_path != instance.version_path {
    return Err(InstanceError::InstallationInstanceMismatch.into());
  }
  match kind {
    InstallKind::ModLoader => {
      if latest.mod_loader.loader_type != instance.mod_loader.loader_type
        || latest.mod_loader.version != instance.mod_loader.version
      {
        return Err(InstanceError::ModLoaderChanged.into());
      }
      latest.mod_loader.status = status.clone();
    }
    InstallKind::Optifine => {
      let optifine = latest
        .optifine
        .as_mut()
        .ok_or(InstanceError::OptifineMissing)?;
      if instance.optifine.as_ref().map(|old| &old.filename) != Some(&optifine.filename) {
        return Err(InstanceError::OptifineChanged.into());
      }
      optifine.status = status.clone();
    }
  }
  latest.save_json_cfg().await?;
  let binding = app.state::<Mutex<HashMap<String, Instance>>>();
  let mut instances = binding.lock().map_err(|error| TaskError::Other {
    details: error.to_string(),
  })?;
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

async fn install(app: &AppHandle, spec: InstallSpec) -> Result<(), TaskError> {
  let InstallSpec {
    target: spec,
    processors,
  } = spec;
  let mut instance = Instance {
    version_path: spec.version_path,
    ..Default::default()
  }
  .load_json_cfg()
  .await?;
  if instance.id != spec.instance_id {
    return Err(InstanceError::InstallationInstanceMismatch.into());
  }
  let status = match spec.kind {
    InstallKind::ModLoader => &instance.mod_loader.status,
    InstallKind::Optifine => {
      &instance
        .optifine
        .as_ref()
        .ok_or(InstanceError::OptifineMissing)?
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
        execute_processors(app, &instance, &client_info, &processors)
          .await
          .map_err(task_error)?;
      }
      InstallKind::Optifine => finish_optifine_install(app, &instance, &client_info)
        .await
        .map_err(task_error)?,
    }
    Ok::<(), TaskError>(())
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
