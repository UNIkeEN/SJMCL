use serde::{Deserialize, Serialize};
use std::{pin::Pin, time::Duration};
use tauri::{AppHandle, Manager};

use crate::{
  error::SJMCLResult,
  tasks::{download::DownloadTask, monitor::TaskMonitor, PTaskParam},
};

use super::{PTaskDesc, THandle};

#[derive(Serialize, Deserialize, Clone)]
pub struct ScheduleResult {
  pub task_descs: Vec<PTaskDesc>,
  pub task_group: String,
}

#[tauri::command]
pub async fn schedule_progressive_task_group(
  app: AppHandle,
  task_group: String,
  params: Vec<PTaskParam>,
) -> SJMCLResult<ScheduleResult> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  let mut task_descs = Vec::new();
  for param in params {
    let task_id = monitor.get_new_id();
    task_descs.push(match param {
      PTaskParam::Download(param) => {
        let task = DownloadTask::new(
          app.clone(),
          task_id,
          Some(task_group.clone()),
          param,
          Duration::from_secs(1),
        );
        let (futute, handle) = task
          .future(app.clone(), monitor.download_rate_limiter.clone())
          .await?;
        let task_desc = handle.read().unwrap().desc.clone();
        monitor
          .enqueue_task(task_id, Some(task_group.clone()), futute, handle)
          .await;
        task_desc
      }
    });
  }
  Ok(ScheduleResult {
    task_descs,
    task_group,
  })
}

#[tauri::command]
pub fn create_transient_task(app: AppHandle, desc: THandle) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.create_transient_task(app.clone(), desc);
  Ok(())
}

#[tauri::command]
pub fn set_transient_task_state(app: AppHandle, task_id: u32, state: String) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.set_transient_task(app.clone(), task_id, state);
  Ok(())
}

#[tauri::command]
pub fn cancel_transient_task(app: AppHandle, task_id: u32) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.cancel_transient_task(task_id);
  Ok(())
}

#[tauri::command]
pub fn get_transient_task(app: AppHandle, task_id: u32) -> SJMCLResult<Option<THandle>> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  Ok(monitor.get_transient_task(task_id))
}

#[tauri::command]
pub fn cancel_progressive_task(app: AppHandle, task_id: u32) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.cancel_progress(task_id);
  Ok(())
}

#[tauri::command]
pub fn resume_progressive_task(app: AppHandle, task_id: u32) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.resume_progress(task_id);
  Ok(())
}

#[tauri::command]
pub async fn restart_progressive_task(app: AppHandle, task_id: u32) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.restart_progress(task_id).await;
  Ok(())
}

#[tauri::command]
pub fn stop_progressive_task(app: AppHandle, task_id: u32) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.stop_progress(task_id);
  Ok(())
}

#[tauri::command]
pub fn retrieve_progressive_task_list(app: AppHandle) -> Vec<PTaskDesc> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.state_list()
}
