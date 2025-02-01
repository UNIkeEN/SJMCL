use super::monitor::TaskMonitor;
use futures::StreamExt;
use std::pin::Pin;
use tauri::{AppHandle, Manager};

pub async fn monitor_background_process(app: AppHandle) {
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  loop {
    let r = tokio::time::timeout(tokio::time::Duration::from_secs(1), async {
      let mut tasks = monitor.tasks.lock().await;
      if tasks.is_empty() {
        drop(tasks);
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        None
      } else {
        Some(tasks.select_next_some().await)
      }
    })
    .await;
    log::info!("progress_monitor: {:?}", r);
  }
}
