//! Store the engine in Tauri managed state.
//! Map EventSink events to AppHandle::emit using the event names below.
//! Expose asynchronous engine methods as Tauri commands.

use std::path::PathBuf;
use std::sync::Arc;

use crate::{
  Engine, EngineEvent, GroupSummary, SubmitGroup,
  download::DownloadExecutor,
  event::EventSink,
  executor::TaskExecutor,
  model::{EngineConfig, Task},
};
use ::tauri::{AppHandle, Emitter, Manager, Runtime, State};

pub struct EngineHandle(pub Engine);

/// Dedicated Tokio runtime: Tauri setup is outside a Tokio runtime,
/// and EngineBuilder::spawn uses tokio::spawn. Retain the runtime so it stays alive.
pub struct EngineRuntime(pub tokio::runtime::Runtime);

/// Host-provided settings used when the plugin initializes its engine.
pub struct EngineSetup {
  pub db_path: PathBuf,
  pub config: EngineConfig,
  pub executor: DownloadExecutor,
  pub extra_executors: Vec<Arc<dyn TaskExecutor>>,
}

/// Tauri EventSink adapter: emit core events through the AppHandle.
pub struct TauriSink<R: Runtime> {
  app: AppHandle<R>,
}

impl<R: Runtime> EventSink for TauriSink<R> {
  fn emit(&self, ev: &EngineEvent) {
    let (name, payload) = match ev {
      EngineEvent::Tick(items) => ("download://tick", serde_json::to_value(items).unwrap()),
      EngineEvent::GroupSubmitted { .. }
      | EngineEvent::TaskStateChanged { .. }
      | EngineEvent::GroupStateChanged { .. } => {
        ("download://state", serde_json::to_value(ev).unwrap())
      }
      EngineEvent::GroupFinished { .. } => {
        ("download://finished", serde_json::to_value(ev).unwrap())
      }
      EngineEvent::TaskFailed { .. } => ("download://error", serde_json::to_value(ev).unwrap()),
      EngineEvent::TaskVerified { .. } => {
        ("download://verified", serde_json::to_value(ev).unwrap())
      }
    };
    let _ = self.app.emit(name, payload);
  }
}

/// Initialize the plugin with SQLite persistence and the download executor.
pub fn init<R: Runtime>() -> ::tauri::plugin::TauriPlugin<R> {
  init_with_setup(|app| {
    Ok(EngineSetup {
      db_path: app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("downloads.db"),
      config: EngineConfig::default(),
      executor: DownloadExecutor::default(),
      extra_executors: Vec::new(),
    })
  })
}

/// Initialize the plugin with a specified SQLite path for tests or embedded hosts.
pub fn init_with_db_path<R: Runtime>(db_path: PathBuf) -> ::tauri::plugin::TauriPlugin<R> {
  init_with_setup(move |_| {
    Ok(EngineSetup {
      db_path,
      config: EngineConfig::default(),
      executor: DownloadExecutor::default(),
      extra_executors: Vec::new(),
    })
  })
}

/// Register commands only; the host must call setup_engine during application setup.
pub fn commands<R: Runtime>() -> ::tauri::plugin::TauriPlugin<R> {
  build_plugin(|_| Ok(None))
}

/// Initialize the plugin from host settings once the host state is available.
pub fn init_with_setup<R: Runtime, F>(configure: F) -> ::tauri::plugin::TauriPlugin<R>
where
  F: FnOnce(&AppHandle<R>) -> Result<EngineSetup, String> + Send + 'static,
{
  build_plugin(move |app| configure(app).map(Some))
}

/// Initialize the engine with host-provided configuration, HTTP client, and database path.
pub fn setup_engine<R: Runtime>(
  app: &AppHandle<R>,
  db_path: PathBuf,
  config: EngineConfig,
  executor: DownloadExecutor,
) -> Result<(), String> {
  setup_engine_with_executors(app, db_path, config, executor, Vec::new())
}

/// Initialize the engine with additional host-specific executors.
pub fn setup_engine_with_executors<R: Runtime>(
  app: &AppHandle<R>,
  db_path: PathBuf,
  config: EngineConfig,
  executor: DownloadExecutor,
  extra_executors: Vec<Arc<dyn TaskExecutor>>,
) -> Result<(), String> {
  if let Some(parent) = db_path.parent() {
    std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }
  let sink = Arc::new(TauriSink { app: app.clone() });
  let store = Arc::new(crate::storage::SqliteStore::open(&db_path)?);
  let mut builder = Engine::builder(config, sink, store);
  builder.register(Arc::new(executor));
  for executor in extra_executors {
    builder.register(executor);
  }
  let runtime = tokio::runtime::Builder::new_multi_thread()
    .enable_all()
    .worker_threads(2)
    .build()
    .map_err(|error| error.to_string())?;
  let (engine, _actor) = {
    let _enter = runtime.enter();
    builder.spawn()
  };
  if !app.manage(EngineHandle(engine)) {
    return Err("download engine is already initialized".into());
  }
  if !app.manage(EngineRuntime(runtime)) {
    return Err("download runtime is already initialized".into());
  }
  Ok(())
}

fn build_plugin<R: Runtime, F>(configure: F) -> ::tauri::plugin::TauriPlugin<R>
where
  F: FnOnce(&AppHandle<R>) -> Result<Option<EngineSetup>, String> + Send + 'static,
{
  ::tauri::plugin::Builder::new("download")
    .setup(move |app, _api| {
      if let Some(setup) = configure(app)? {
        setup_engine_with_executors(
          app,
          setup.db_path,
          setup.config,
          setup.executor,
          setup.extra_executors,
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      submit_group,
      pause_group,
      resume_group,
      cancel_group,
      retry_group,
      remove_group,
      snapshot,
      list_tasks
    ])
    .build()
}

#[tauri::command]
async fn submit_group(
  state: State<'_, EngineHandle>,
  payload: SubmitGroup,
) -> Result<String, String> {
  state
    .0
    .submit_group(payload)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn pause_group(state: State<'_, EngineHandle>, group_id: String) -> Result<(), String> {
  state.0.pause(group_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn resume_group(state: State<'_, EngineHandle>, group_id: String) -> Result<(), String> {
  state.0.resume(group_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cancel_group(state: State<'_, EngineHandle>, group_id: String) -> Result<(), String> {
  state.0.cancel(group_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn retry_group(state: State<'_, EngineHandle>, group_id: String) -> Result<(), String> {
  state.0.retry(group_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_group(state: State<'_, EngineHandle>, group_id: String) -> Result<(), String> {
  state.0.remove(group_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn snapshot(state: State<'_, EngineHandle>) -> Result<Vec<GroupSummary>, String> {
  state.0.snapshot().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_tasks(state: State<'_, EngineHandle>, group_id: String) -> Result<Vec<Task>, String> {
  state
    .0
    .list_tasks(group_id)
    .await
    .map_err(|e| e.to_string())
}
