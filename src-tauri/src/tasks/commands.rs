use std::{pin::Pin, time::Duration};
use tauri::Manager;

use crate::{
  error::SJMCLResult,
  launcher_config::commands::retrive_launcher_config,
  tasks::{download::DownloadTask, monitor::TaskMonitor, TaskParam, TaskState},
};

#[tauri::command]
pub async fn schedule_one_task(app: tauri::AppHandle, param: TaskParam) -> SJMCLResult<u32> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  let config = retrive_launcher_config(app.clone())?;
  let task_id = monitor.get_new_id();
  match param {
    TaskParam::Download(param) => {
      let task = DownloadTask::new(
        app.clone(),
        task_id,
        config.download.cache.directory,
        param,
        Duration::from_secs(1),
      );
      let (futute, state) = task.future().await?;
      monitor.enqueue_task(task_id, futute, Some(state)).await;
    }
  };
  Ok(task_id)
}

#[tauri::command]
pub fn cancel_one_task(app: tauri::AppHandle, task_id: u32) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.cancel_progress(task_id);
  Ok(())
}

#[tauri::command]
pub fn resume_one_task(app: tauri::AppHandle, task_id: u32) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.resume_progress(task_id);
  Ok(())
}

#[tauri::command]
pub fn stop_one_task(app: tauri::AppHandle, task_id: u32) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.stop_progress(task_id);
  Ok(())
}

#[tauri::command]
pub fn retrieve_task_list(app: tauri::AppHandle) -> Vec<TaskState> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.state_list()
}
