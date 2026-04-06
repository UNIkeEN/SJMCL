use std::{ffi::OsStr, fs};

use crate::{
  error::SJMCLResult,
  multiplayer::helpers::terracotta::{build_download_param, decompress},
  resource::models::ResourceError,
  tasks::commands::schedule_progressive_task_group,
};
use serde_json::Value;
use tauri::{path::BaseDirectory, AppHandle, Manager};
use tokio::process::Command;

#[tauri::command]
pub async fn check_terracotta(app: AppHandle) -> SJMCLResult<bool> {
  let dir = &app.path().resolve("terracotta", BaseDirectory::AppData)?;
  println!("Checking if Terracotta is installed at: {:?}", dir);
  Ok(dir.exists())
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
        } else if cfg!(target_os = "macos") {
          None // TODO: 不知道安装后是什么
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
  Ok(())
}

#[tauri::command]
pub async fn download_terracotta(app: AppHandle) -> SJMCLResult<()> {
  let download_param = build_download_param(&app).await?;
  if download_param.is_empty() {
    return Err(ResourceError::NoDownloadApi.into());
  }
  schedule_progressive_task_group(app.clone(), "terracotta".to_string(), download_param, false)
    .await?;
  decompress(&app)?;
  // TODO: 如果是 macOS 还需要安装
  Ok(())
}

#[tauri::command]
pub async fn fetch_port(app: AppHandle) -> SJMCLResult<u16> {
  let path = &app
    .path()
    .resolve("sjmcl-terracotta", BaseDirectory::Temp)?;
  loop {
    if path.exists() {
      let content = fs::read_to_string(path)?;
      let json: Value = serde_json::from_str(&content)?;
      if let Some(port) = json.get("port").and_then(|v| v.as_u64()) {
        return Ok(port as u16);
      }
      tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
  }
}
