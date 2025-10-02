use crate::error::SJMCLResult;
use crate::launcher_config::helpers::memory::get_memory_info;
use crate::launcher_config::models::{LauncherConfigError, MemoryInfo};
use crate::utils::fs::extract_filename as extract_filename_helper;
use font_loader::system_fonts;
use std::fs;
use tauri_plugin_http::reqwest;
use tokio::time::Instant;
use url::Url;

#[tauri::command]
pub fn retrieve_memory_info() -> SJMCLResult<MemoryInfo> {
  Ok(get_memory_info())
}

#[tauri::command]
pub fn extract_filename(path_str: String, with_ext: bool) -> SJMCLResult<String> {
  Ok(extract_filename_helper(&path_str, with_ext))
}

#[tauri::command]
pub fn delete_file(path: String) -> SJMCLResult<()> {
  fs::remove_file(&path).map_err(Into::into)
}

#[tauri::command]
pub fn delete_directory(path: String) -> SJMCLResult<()> {
  fs::remove_dir_all(&path).map_err(Into::into)
}

#[tauri::command]
pub fn retrieve_truetype_font_list() -> SJMCLResult<Vec<String>> {
  let sysfonts = system_fonts::query_all();
  Ok(sysfonts)
}

#[tauri::command]
pub async fn check_service_availability(
  client: tauri::State<'_, reqwest::Client>,
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
