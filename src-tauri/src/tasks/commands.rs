use std::{pin::Pin, time::Duration};
use tauri::{AppHandle, Manager};

use crate::{
  error::SJMCLResult,
  tasks::{download::DownloadTask, monitor::TaskMonitor},
  utils::fs::extract_filename,
};

use super::{PTaskGroupDesc, PTaskParam, THandle};

#[tauri::command]
pub async fn schedule_progressive_task_group(
  app: AppHandle,
  task_group: String,
  params: Vec<PTaskParam>,
  with_timestamp: bool,
) -> SJMCLResult<PTaskGroupDesc> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  let mut task_descs = Vec::new();

  let task_group = if with_timestamp {
    // If with_timestamp is true, append a timestamp to the task group name
    // to ensure uniqueness and avoid conflicts.
    let timestamp = chrono::Utc::now().timestamp_millis();
    format!("{}@{}", task_group, timestamp)
  } else {
    task_group.clone()
  };

  for param in params {
    let task_id = monitor.get_new_id();
    task_descs.push(match param {
      PTaskParam::Download(mut param) => {
        if param.filename.is_none() {
          param.filename = Some(extract_filename(
            param.dest.to_str().unwrap_or_default(),
            true,
          ));
        }
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
  Ok(PTaskGroupDesc {
    task_group,
    task_descs,
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
pub fn cancel_progressive_task_group(app: AppHandle, task_group: String) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.cancel_progressive_task_group(task_group);
  Ok(())
}

#[tauri::command]
pub fn resume_progressive_task_group(app: AppHandle, task_group: String) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.resume_progressive_task_group(task_group);
  Ok(())
}

#[tauri::command]
pub fn stop_progressive_task_group(app: AppHandle, task_group: String) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.stop_progressive_task_group(task_group);
  Ok(())
}

#[tauri::command]
pub fn retrieve_progressive_task_list(app: AppHandle) -> Vec<PTaskGroupDesc> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.state_list()
}
