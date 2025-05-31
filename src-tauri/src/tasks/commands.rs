use governor::DefaultDirectRateLimiter;
use serde::{Deserialize, Serialize};
use std::{pin::Pin, time::Duration};
use tauri::{AppHandle, State};

use crate::{
  error::SJMCLResult,
  tasks::{
    download::DownloadTask, monitor::TaskMonitor, ProgressiveTaskDescriptor, ProgressiveTaskParam,
  },
};

use super::TransientTaskDescriptor;

#[derive(Serialize, Deserialize, Clone)]
pub struct ScheduleResult {
  pub task_ids: Vec<u32>,
  pub task_group: String,
}

#[tauri::command]
pub async fn schedule_progressive_task_group(
  app: AppHandle,
  task_group: String,
  params: Vec<ProgressiveTaskParam>,
  task_monitor_state: State<'_, Pin<Box<TaskMonitor>>>,
) -> SJMCLResult<ScheduleResult> {
  // SAFETY: THIS IS A SHITTY WORKAROUND CAUSED BY TAURI.
  // Notably, Task monitor is a STATIC state managed by Tauri Globally.
  // AppHandle implementation lost track of lifetime of the state reference.
  // We have to transmute the reference to a static lifetime so that
  // it can be used in the async block. Plus even though the
  // ratelimited future is self-referencing the monitor, the
  // monitor is pinned anyway so it's safe to use it in the async block.
  let ratelimiter: &'static Option<DefaultDirectRateLimiter> =
    unsafe { std::mem::transmute(&task_monitor_state.download_rate_limiter) };

  let mut task_ids = Vec::new();
  for param in params {
    let task_id = task_monitor_state.get_new_id();
    match param {
      ProgressiveTaskParam::Download(param) => {
        let task = DownloadTask::new(
          app.clone(),
          task_id,
          Some(task_group.clone()),
          param,
          Duration::from_secs(1),
        );
        if ratelimiter.is_none() {
          let (futute, state) = task.future().await?;
          task_monitor_state
            .enqueue_task(task_id, Some(task_group.clone()), futute, Some(state))
            .await;
        } else {
          let (futute, state) = task
            .future_with_ratelimiter(ratelimiter.as_ref().unwrap())
            .await?;
          task_monitor_state
            .enqueue_task(task_id, Some(task_group.clone()), futute, Some(state))
            .await;
        }
      }
    };
    task_ids.push(task_id);
  }

  Ok(ScheduleResult {
    task_ids,
    task_group,
  })
}

#[tauri::command]
pub fn create_transient_task(
  app: AppHandle,
  desc: TransientTaskDescriptor,
  task_monitor_state: State<'_, Pin<Box<TaskMonitor>>>,
) -> SJMCLResult<()> {
  task_monitor_state.create_transient_task(app.clone(), desc);
  Ok(())
}

#[tauri::command]
pub fn set_transient_task_state(
  app: AppHandle,
  task_id: u32,
  state: String,
  task_monitor_state: State<'_, Pin<Box<TaskMonitor>>>,
) -> SJMCLResult<()> {
  task_monitor_state.set_transient_task(app.clone(), task_id, state);
  Ok(())
}

#[tauri::command]
pub fn cancel_transient_task(
  task_id: u32,
  task_monitor_state: State<'_, Pin<Box<TaskMonitor>>>,
) -> SJMCLResult<()> {
  task_monitor_state.cancel_transient_task(task_id);
  Ok(())
}

#[tauri::command]
pub fn get_transient_task(
  task_id: u32,
  task_monitor_state: State<'_, Pin<Box<TaskMonitor>>>,
) -> SJMCLResult<Option<TransientTaskDescriptor>> {
  Ok(task_monitor_state.get_transient_task(task_id))
}

#[tauri::command]
pub fn cancel_progressive_task(
  task_id: u32,
  task_monitor_state: State<'_, Pin<Box<TaskMonitor>>>,
) -> SJMCLResult<()> {
  task_monitor_state.cancel_progress(task_id);
  Ok(())
}

#[tauri::command]
pub fn resume_progressive_task(
  task_id: u32,
  task_monitor_state: State<'_, Pin<Box<TaskMonitor>>>,
) -> SJMCLResult<()> {
  task_monitor_state.resume_progress(task_id);
  Ok(())
}

#[tauri::command]
pub fn stop_progressive_task(
  task_id: u32,
  task_monitor_state: State<'_, Pin<Box<TaskMonitor>>>,
) -> SJMCLResult<()> {
  task_monitor_state.stop_progress(task_id);
  Ok(())
}

#[tauri::command]
pub fn retrieve_progressive_task_list(
  task_monitor_state: State<'_, Pin<Box<TaskMonitor>>>,
) -> Vec<ProgressiveTaskDescriptor> {
  task_monitor_state.state_list()
}
