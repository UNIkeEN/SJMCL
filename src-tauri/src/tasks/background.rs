use super::monitor::TaskMonitor;
use std::pin::Pin;
use tauri::{AppHandle, Manager};

pub async fn monitor_background_process(app: AppHandle) {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.background_process().await;
}
