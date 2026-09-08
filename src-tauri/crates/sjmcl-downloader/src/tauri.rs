//! - Engine 放在 managed state
//! - EventSink → `app.emit`（事件名见 event_name）
//! - commands 封装 Engine 的异步方法

use std::path::PathBuf;
use std::sync::Arc;

use crate::{
  Engine, EngineEvent, GroupSummary, SubmitGroup,
  download::DownloadExecutor,
  event::EventSink,
  model::{EngineConfig, Task},
};
use ::tauri::{AppHandle, Emitter, Manager, Runtime, State};

pub struct EngineHandle(pub Engine);

/// 引擎专属 tokio 运行时。tauri 的 setup 钩子不在 tokio 上下文里，
/// `EngineBuilder::spawn()` 用 `tokio::spawn` 需要它；持有以防 drop 关闭。
pub struct EngineRuntime(pub tokio::runtime::Runtime);

/// EventSink 的 tauri 适配器：core 事件 → window.emit。
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

/// 初始化插件：构造引擎（SQLite 持久化 + download executor）。
pub fn init<R: Runtime>() -> ::tauri::plugin::TauriPlugin<R> {
  build_plugin(true, None)
}

/// 使用指定 SQLite 文件初始化插件，供集成测试或嵌入方隔离数据目录。
pub fn init_with_db_path<R: Runtime>(db_path: PathBuf) -> ::tauri::plugin::TauriPlugin<R> {
  build_plugin(true, Some(db_path))
}

/// 仅注册命令；嵌入方须在应用 setup 中调用 [`setup_engine`]。
pub fn commands<R: Runtime>() -> ::tauri::plugin::TauriPlugin<R> {
  build_plugin(false, None)
}

/// 使用宿主提供的配置、HTTP 客户端和数据库位置初始化引擎。
pub fn setup_engine<R: Runtime>(
  app: &AppHandle<R>,
  db_path: PathBuf,
  config: EngineConfig,
  executor: DownloadExecutor,
) -> Result<(), String> {
  if let Some(parent) = db_path.parent() {
    std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }
  let sink = Arc::new(TauriSink { app: app.clone() });
  let store = Arc::new(crate::storage::SqliteStore::open(&db_path)?);
  let mut builder = Engine::builder(config, sink, store);
  builder.register(Arc::new(executor));
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

fn build_plugin<R: Runtime>(
  initialize: bool,
  db_path: Option<PathBuf>,
) -> ::tauri::plugin::TauriPlugin<R> {
  ::tauri::plugin::Builder::new("download")
    .setup(move |app, _api| {
      if !initialize {
        return Ok(());
      }
      let db_path = match &db_path {
        Some(path) => path.clone(),
        None => app
          .path()
          .app_data_dir()
          .expect("app data dir")
          .join("downloads.db"),
      };
      setup_engine(
        &app.clone(),
        db_path,
        EngineConfig::default(),
        DownloadExecutor::default(),
      )
      .map_err(Into::into)
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
