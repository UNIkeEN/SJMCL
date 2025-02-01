use governor::DefaultDirectRateLimiter;
use serde::{Deserialize, Serialize};
use std::{pin::Pin, time::Duration};
use tauri::Manager;

use crate::{
  error::SJMCLResult,
  tasks::{download::DownloadTask, monitor::TaskMonitor, TaskParam, TaskState},
};

#[derive(Serialize, Deserialize, Clone)]
pub struct TaskResult {
  pub task_ids: Vec<u32>,
  pub task_group: String,
}

#[tauri::command]
pub async fn schedule_task_group(
  app: tauri::AppHandle,
  task_group: String,
  params: Vec<TaskParam>,
) -> SJMCLResult<TaskResult> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  // SAFETY: THIS IS A SHITTY WORKAROUND CAUSED BY TAURI.
  // Notably, Task monitor is a STATIC state managed by Tauri Globally.
  // AppHandle implementation lost track of lifetime of the state reference.
  // We have to transmute the reference to a static lifetime so that
  // it can be used in the async block. Plus even though the
  // ratelimited future is self-referencing the monitor, the
  // monitor is pinned anyway so it's safe to use it in the async block.
  let ratelimiter: &'static Option<DefaultDirectRateLimiter> =
    unsafe { std::mem::transmute(&monitor.download_rate_limiter) };
  let mut task_ids = Vec::new();
  for param in params {
    let task_id = monitor.get_new_id();
    match param {
      TaskParam::Download(param) => {
        let task = DownloadTask::new(
          app.clone(),
          task_id,
          Some(task_group.clone()),
          param,
          Duration::from_secs(1),
        );
        if ratelimiter.is_none() {
          let (futute, state) = task.future().await?;
          monitor
            .enqueue_task(task_id, Some(task_group.clone()), futute, Some(state))
            .await;
        } else {
          let (futute, state) = task
            .future_with_ratelimiter(ratelimiter.as_ref().unwrap())
            .await?;
          monitor
            .enqueue_task(task_id, Some(task_group.clone()), futute, Some(state))
            .await;
        }
      }
    };
    task_ids.push(task_id);
  }

  Ok(TaskResult {
    task_ids,
    task_group,
  })
}

#[tauri::command]
pub fn cancel_task(app: tauri::AppHandle, task_id: u32) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.cancel_progress(task_id);
  Ok(())
}

#[tauri::command]
pub fn resume_task(app: tauri::AppHandle, task_id: u32) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.resume_progress(task_id);
  Ok(())
}

#[tauri::command]
pub fn stop_task(app: tauri::AppHandle, task_id: u32) -> SJMCLResult<()> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.stop_progress(task_id);
  Ok(())
}

#[tauri::command]
pub fn retrieve_task_list(app: tauri::AppHandle) -> Vec<TaskState> {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.state_list()
}
