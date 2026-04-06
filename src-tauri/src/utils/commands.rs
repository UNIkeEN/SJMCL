use crate::error::SJMCLResult;
use crate::launcher_config::models::{LauncherConfigError, MemoryInfo};
use crate::utils::fs::extract_filename as extract_filename_helper;
use crate::utils::sys_info::get_memory_info;
use font_loader::system_fonts;
use serde_json::Value;
use std::fs;
use tauri_plugin_http::reqwest;
use tauri_plugin_http::reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use tauri_plugin_http::reqwest::Method;
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
pub fn read_file(path: String) -> SJMCLResult<String> {
  fs::read_to_string(&path).map_err(Into::into)
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> SJMCLResult<()> {
  if let Some(parent) = std::path::Path::new(&path).parent() {
    fs::create_dir_all(parent)?;
  }
  fs::write(&path, content).map_err(Into::into)
}

#[tauri::command]
pub async fn request(
  client: tauri::State<'_, reqwest::Client>,
  url: String,
  method: Option<String>,
  options: Option<Value>,
) -> SJMCLResult<String> {
  async {
    let parse_headers = |headers: &serde_json::Map<String, Value>| -> Result<HeaderMap, ()> {
      let mut header_map = HeaderMap::new();
      for (key, value) in headers {
        let value = value.as_str().ok_or(())?;
        let header_name = HeaderName::from_bytes(key.as_bytes()).map_err(|_| ())?;
        let header_value = HeaderValue::from_str(value).map_err(|_| ())?;
        header_map.insert(header_name, header_value);
      }
      Ok(header_map)
    };

    let method = Method::from_bytes(method.unwrap_or_else(|| "GET".to_string()).as_bytes())
      .map_err(|_| LauncherConfigError::FetchError)?;

    let mut request = client.request(method, url);

    if let Some(options) = options {
      if let Some(headers) = options.get("headers").and_then(|value| value.as_object()) {
        request =
          request.headers(parse_headers(headers).map_err(|_| LauncherConfigError::FetchError)?);
      }
      if let Some(body) = options.get("body").and_then(|value| value.as_str()) {
        request = request.body(body.to_string());
      }
    }

    let response = request
      .send()
      .await
      .map_err(|_| LauncherConfigError::FetchError)?;
    response
      .text()
      .await
      .map_err(|_| LauncherConfigError::FetchError)
  }
  .await
  .map_err(Into::into)
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
