use std::pin::Pin;
use std::time::Duration;
use std::{ffi::OsStr, fs};

use crate::{
  error::{SJMCLError, SJMCLResult},
  multiplayer::helpers::terracotta::{build_download_param, decompress},
  resource::models::ResourceError,
  tasks::commands::schedule_progressive_task_group,
  tasks::monitor::TaskMonitor,
};
use serde_json::Value;
use tauri::{path::BaseDirectory, AppHandle, Manager};
use tokio::process::Command;

#[tauri::command]
pub async fn check_terracotta(app: AppHandle) -> SJMCLResult<bool> {
  let dir = &app.path().resolve("terracotta", BaseDirectory::AppData)?;
  println!("Checking if Terracotta is installed at: {:?}", dir);
  Ok(dir.exists() && fs::read_dir(dir)?.next().is_some())
}

#[tauri::command]
pub async fn launch_terracotta(app: AppHandle) -> SJMCLResult<()> {
  let dir = &app.path().resolve("terracotta", BaseDirectory::AppData)?;

  for entry in fs::read_dir(&dir)? {
    let entry = entry?;
    let path = entry.path();

    if path.is_file()
      && path.extension()
        == if cfg!(target_os = "windows") {
          Some(OsStr::new("exe"))
        } else {
          None
        }
    {
      Command::new(path)
        .arg("--hmcl")
        .arg(
          &app
            .path()
            .resolve("sjmcl-terracotta", BaseDirectory::Temp)?,
        )
        .spawn()?;
      return Ok(());
    }
  }
  Err(SJMCLError("terracotta executable not found".into()))
}

#[tauri::command]
pub async fn download_terracotta(app: AppHandle) -> SJMCLResult<()> {
  let download_param = build_download_param(&app).await?;
  if download_param.is_empty() {
    return Err(ResourceError::NoDownloadApi.into());
  }
  let task_group =
    schedule_progressive_task_group(app.clone(), "terracotta".to_string(), download_param, false)
      .await?;

  let monitor = app.state::<Pin<Box<TaskMonitor>>>();
  monitor.wait_for_task_group(&task_group.task_group).await?;

  log::info!("Terracotta downloaded, starting decompression...");
  decompress(&app).await?;
  log::info!("Terracotta decompressed successfully.");
  Ok(())
}

#[tauri::command]
pub async fn fetch_port(app: AppHandle) -> SJMCLResult<u16> {
  let path = &app
    .path()
    .resolve("sjmcl-terracotta", BaseDirectory::Temp)?;
  for _ in 0..6 {
    if path.exists() {
      let content = tokio::fs::read_to_string(path).await?;
      let json: Value = serde_json::from_str(&content)?;
      if let Some(port) = json.get("port").and_then(|v| v.as_u64()) {
        return Ok(port as u16);
      }
      tokio::time::sleep(Duration::from_millis(500)).await;
    }
  }
  Err(SJMCLError("terracotta port file not found".into()))
}
