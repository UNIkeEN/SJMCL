use super::monitor::{RuntimeGroupDescSnapshot, TaskCommand, TaskMonitor};
use super::RuntimeTaskParam;
use crate::error::SJMCLResult;
use std::pin::Pin;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn schedule_progressive_task_group(
  app: AppHandle,
  task_group: String,
  params: Vec<RuntimeTaskParam>,
  with_timestamp: bool,
) -> SJMCLResult<RuntimeGroupDescSnapshot> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  let task_group = if with_timestamp {
    // append a timestamp to the task group name to ensure uniqueness.
    let timestamp = chrono::Utc::now().timestamp_millis();
    format!("{task_group}@{timestamp}")
  } else {
    task_group.clone()
  };
  Ok(monitor.schedule_task_group(task_group, params).await)
}

#[tauri::command]
pub async fn cancel_progressive_task_group(app: AppHandle, task_group: String) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.apply_cmd(task_group, TaskCommand::Cancel).await;
  Ok(())
}

#[tauri::command]
pub async fn resume_progressive_task_group(app: AppHandle, task_group: String) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.apply_cmd(task_group, TaskCommand::Resume).await;
  Ok(())
}

#[tauri::command]
pub async fn stop_progressive_task_group(app: AppHandle, task_group: String) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.apply_cmd(task_group, TaskCommand::Stop).await;
  Ok(())
}

#[tauri::command]
pub async fn retry_progressive_task_group(app: AppHandle, task_group: String) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.apply_cmd(task_group, TaskCommand::Retry).await;
  Ok(())
}

#[tauri::command]
pub fn retrieve_progressive_task_list(app: AppHandle) -> Vec<RuntimeGroupDescSnapshot> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.state_list()
}
