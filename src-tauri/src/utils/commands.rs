use base64::{Engine, engine::general_purpose};
use font_loader::system_fonts;
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::fs;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_http::reqwest;
use tokio::time::Instant;
use url::Url;

use crate::launcher_config::models::{LauncherConfigError, MemoryInfo};
use crate::utils::fs::extract_filename as extract_filename_helper;
use crate::utils::sys_info::get_memory_info;

#[tauri::command]
pub fn retrieve_memory_info() -> SJMCLResult<MemoryInfo> {
  Ok(get_memory_info())
}

#[tauri::command]
pub fn retrieve_resolution_upbound(app: AppHandle) -> SJMCLResult<(u32, u32)> {
  let monitors = app
    .get_webview_window("main")
    .and_then(|w| w.available_monitors().ok())
    .unwrap_or_default();

  monitors
    .iter()
    .max_by_key(|m| {
      let s = m.size();
      s.width * s.height
    })
    .map(|m| {
      let s = m.size();
      (s.width, s.height)
    })
    .ok_or_else(|| SJMCLError("No monitor available".into()))
}

#[tauri::command]
pub fn retrieve_truetype_font_list() -> SJMCLResult<Vec<String>> {
  let sysfonts = system_fonts::query_all();
  Ok(sysfonts)
}

#[tauri::command]
pub async fn check_service_availability(
  client: State<'_, reqwest::Client>,
  url: String,
) -> SJMCLResult<u128> {
  let parsed_url = Url::parse(&url)
    .or_else(|_| Url::parse(&format!("https://{}", url)))
    .map_err(|_| LauncherConfigError::FetchError)?;

  let start = Instant::now();
  let res = client.get(parsed_url).send().await;

  match res {
    Ok(response) => {
      if response.status().is_success() || response.status().is_client_error() {
        Ok(start.elapsed().as_millis())
      } else {
        Err(LauncherConfigError::FetchError.into())
      }
    }
    Err(_) => Err(LauncherConfigError::FetchError.into()),
  }
}

#[tauri::command]
pub fn extract_filename(path_str: String, with_ext: bool) -> SJMCLResult<String> {
  Ok(extract_filename_helper(&path_str, with_ext))
}

// ------- Additional file commands for extensions. -------

#[tauri::command]
pub fn delete_file(path: String) -> SJMCLResult<()> {
  fs::remove_file(&path).map_err(Into::into)
}

#[tauri::command]
pub fn delete_directory(path: String) -> SJMCLResult<()> {
  fs::remove_dir_all(&path).map_err(Into::into)
}

#[tauri::command]
pub fn read_file(path: String, mode: Option<String>) -> SJMCLResult<String> {
  match mode.unwrap_or_else(|| "string".to_string()).as_str() {
    "string" => fs::read_to_string(&path).map_err(Into::into),
    "base64" => fs::read(&path)
      .map(|bytes| general_purpose::STANDARD.encode(bytes))
      .map_err(Into::into),
    value => Err(SJMCLError(format!("Unsupported mode: {value}"))),
  }
}

#[tauri::command]
pub fn write_file(path: String, content: String, mode: Option<String>) -> SJMCLResult<()> {
  if let Some(parent) = std::path::Path::new(&path).parent() {
    fs::create_dir_all(parent)?;
  }

  match mode.unwrap_or_else(|| "string".to_string()).as_str() {
    "string" => fs::write(&path, content).map_err(Into::into),
    "base64" => fs::write(&path, general_purpose::STANDARD.decode(content)?).map_err(Into::into),
    value => Err(SJMCLError(format!("Unsupported mode: {value}"))),
  }
}
