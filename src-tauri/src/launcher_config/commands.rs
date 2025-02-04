use super::models::{LauncherConfig, LauncherConfigError, MemoryInfo};
use crate::storage::Storage;
use crate::{error::SJMCLResult, partial::PartialUpdate};
use std::fs;
use std::path::{Path, PathBuf};
use systemstat::{saturating_sub_bytes, Platform};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

#[tauri::command]
pub fn retrive_launcher_config() -> SJMCLResult<LauncherConfig> {
  let state: LauncherConfig = Storage::load().unwrap_or_default();
  Ok(state)
}

#[tauri::command]
pub fn update_launcher_config(key_path: String, value: String) -> SJMCLResult<()> {
  let mut snake = String::new();
  for (i, ch) in key_path.char_indices() {
    if i > 0 && ch.is_uppercase() {
      snake.push('_');
    }
    snake.push(ch.to_ascii_lowercase());
  }
  let mut state: LauncherConfig = Storage::load().unwrap_or_default();
  state.update(&snake, &value)?;
  state.save()?;
  Ok(())
}

#[tauri::command]
pub fn restore_launcher_config(app: AppHandle) -> SJMCLResult<LauncherConfig> {
  let mut state = LauncherConfig::default();
  // Set and create default download cache dir
  state.download.cache.directory = app
    .path()
    .resolve::<PathBuf>("Download".into(), BaseDirectory::AppCache)?;
  if !state.download.cache.directory.exists() {
    fs::create_dir_all(&state.download.cache.directory).unwrap();
  }
  state.save()?;
  Ok(state)
}

#[tauri::command]
pub async fn export_launcher_config(app: AppHandle) -> SJMCLResult<String> {
  let state: LauncherConfig = Storage::load().unwrap_or_default();
  let client = reqwest::Client::new();
  match client
    .post("https://mc.sjtu.cn/api-sjmcl/settings")
    .header("Content-Type", "application/json")
    .body(
      serde_json::json!({
        "version": app.package_info().version.to_string(),
        "json_data": state.clone(),
      })
      .to_string(),
    )
    .send()
    .await
  {
    Ok(response) => {
      let status = response.status();
      let json: serde_json::Value = response
        .json()
        .await
        .map_err(|_| LauncherConfigError::FetchError)?;
      if status.is_success() {
        let code = json["code"]
          .as_str()
          .ok_or_else(|| LauncherConfigError::FetchError)?
          .to_string();

        Ok(code)
      } else {
        Err(LauncherConfigError::FetchError.into())
      }
    }
    Err(_) => Err(LauncherConfigError::FetchError.into()),
  }
}

#[tauri::command]
pub async fn import_launcher_config(app: AppHandle, code: String) -> SJMCLResult<LauncherConfig> {
  let client = reqwest::Client::new();
  match client
    .post("https://mc.sjtu.cn/api-sjmcl/validate")
    .header("Content-Type", "application/json")
    .body(
      serde_json::json!({
        "version": app.package_info().version.to_string(),
        "code": code,
      })
      .to_string(),
    )
    .send()
    .await
  {
    Ok(response) => {
      let status = response.status();
      let json: serde_json::Value = response
        .json()
        .await
        .map_err(|_| LauncherConfigError::FetchError)?;
      if status.is_success() {
        let state: LauncherConfig =
          serde_json::from_value(json).map_err(|_| LauncherConfigError::FetchError)?;
        state.save()?;

        Ok(state)
      } else {
        let message = json["message"]
          .as_str()
          .ok_or_else(|| LauncherConfigError::FetchError)?;
        match message {
          "Invalid code" => Err(LauncherConfigError::InvalidCode.into()),
          "Code expired" => Err(LauncherConfigError::CodeExpired.into()),
          "Version mismatch" => Err(LauncherConfigError::VersionMismatch.into()),
          _ => Err(LauncherConfigError::FetchError.into()),
        }
      }
    }
    Err(_err) => Err(LauncherConfigError::FetchError.into()),
  }
}

#[tauri::command]
pub fn retrive_memory_info() -> SJMCLResult<MemoryInfo> {
  let sys = systemstat::System::new();
  let mem = sys.memory()?;
  Ok(MemoryInfo {
    total: mem.total.as_u64(),
    used: saturating_sub_bytes(mem.total, mem.free).as_u64(),
  })
}

#[tauri::command]
pub fn retrive_custom_background_list(app: AppHandle) -> SJMCLResult<Vec<String>> {
  let custom_bg_dir = app
    .path()
    .resolve::<PathBuf>("UserContent/Backgrounds".into(), BaseDirectory::AppData)?;

  if !custom_bg_dir.exists() {
    return Ok(Vec::new());
  }

  let valid_extensions = ["jpg", "jpeg", "png", "gif", "webp"];

  let file_names: Vec<String> = fs::read_dir(custom_bg_dir)?
    .filter_map(|entry| entry.ok())
    .filter_map(|entry| {
      let file_name = entry.file_name().into_string().ok()?;
      let extension = Path::new(&file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase());

      if extension.is_some() && valid_extensions.contains(&extension.unwrap().as_str()) {
        Some(file_name)
      } else {
        None
      }
    })
    .collect();

  Ok(file_names)
}

#[tauri::command]
pub fn add_custom_background(app: AppHandle, source_src: String) -> SJMCLResult<String> {
  let source_path = Path::new(&source_src);
  if !source_path.exists() || !source_path.is_file() {
    return Ok(String::new());
  }

  // Copy to custom background dir under tauri's pre-defined app_data dir
  let custom_bg_dir = app
    .path()
    .resolve::<PathBuf>("UserContent/Backgrounds".into(), BaseDirectory::AppData)?;

  if !custom_bg_dir.exists() {
    fs::create_dir_all(&custom_bg_dir)?;
  }

  let file_name = source_path.file_name().unwrap();
  let dest_path = custom_bg_dir.join(file_name);
  fs::copy(&source_path, &dest_path)?;

  Ok(file_name.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_custom_background(app: AppHandle, file_name: String) -> SJMCLResult<()> {
  let custom_bg_dir = app
    .path()
    .resolve::<PathBuf>("UserContent/Backgrounds".into(), BaseDirectory::AppData)?;
  let file_path = custom_bg_dir.join(file_name);

  if file_path.exists() && file_path.is_file() {
    fs::remove_file(&file_path)?;
  }
  Ok(())
}
