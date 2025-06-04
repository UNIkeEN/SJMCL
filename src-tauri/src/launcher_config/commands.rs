use super::{
  helpers::java::{
    get_java_info_from_command, get_java_info_from_release_file, refresh_and_update_javas,
  },
  helpers::memory::get_memory_info,
  models::{GameDirectory, JavaInfo, LauncherConfig, LauncherConfigError, MemoryInfo},
};
use crate::{
  error::SJMCLResult, instance::helpers::misc::refresh_instances, partial::PartialUpdate,
};
use crate::{storage::Storage, utils::fs::get_subdirectories};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use tokio::time::Instant;
use url::Url;

#[tauri::command]
pub fn retrieve_launcher_config(app: AppHandle) -> SJMCLResult<LauncherConfig> {
  let binding = app.state::<Mutex<LauncherConfig>>();
  let state = binding.lock()?;
  Ok(state.clone())
}

#[tauri::command]
pub fn update_launcher_config(app: AppHandle, key_path: String, value: String) -> SJMCLResult<()> {
  let binding = app.state::<Mutex<LauncherConfig>>();
  let mut state = binding.lock()?;
  let key_path = {
    let mut snake = String::new();
    for (i, ch) in key_path.char_indices() {
      if i > 0 && ch.is_uppercase() {
        snake.push('_');
      }
      snake.push(ch.to_ascii_lowercase());
    }
    snake
  };
  state.update(&key_path, &value)?;
  state.save()?;
  Ok(())
}

#[tauri::command]
pub fn restore_launcher_config(app: AppHandle) -> SJMCLResult<LauncherConfig> {
  let mut default_config = LauncherConfig::default();
  default_config.setup_with_app(&app)?;

  let binding = app.state::<Mutex<LauncherConfig>>();
  let mut state = binding.lock()?;

  let preserved_fields = &["run_count"];
  state.replace_with_preserved(default_config, preserved_fields);
  state.save()?;
  Ok(state.clone())
}

#[tauri::command]
pub async fn export_launcher_config(
  app: AppHandle,
  client: tauri::State<'_, reqwest::Client>,
) -> SJMCLResult<String> {
  let binding = app.state::<Mutex<LauncherConfig>>();
  let state = { binding.lock()?.clone() };
  match client
    .post("https://mc.sjtu.cn/api-sjmcl/settings")
    .header("Content-Type", "application/json")
    .body(
      serde_json::json!({
        "version": app.package_info().version.to_string(),
        "json_data": state,
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
          .ok_or(LauncherConfigError::FetchError)?
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
pub async fn import_launcher_config(
  app: AppHandle,
  client: tauri::State<'_, reqwest::Client>,
  code: String,
) -> SJMCLResult<LauncherConfig> {
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
        let new_config: LauncherConfig =
          serde_json::from_value(json).map_err(|_| LauncherConfigError::FetchError)?;
        let binding = app.state::<Mutex<LauncherConfig>>();
        let mut state = binding.lock()?;

        let preserved_fields = &["run_count", "local_game_directories", "extra_java_paths"];
        state.replace_with_preserved(new_config, preserved_fields);
        state.save()?;

        Ok(state.clone())
      } else {
        let message = json["message"]
          .as_str()
          .ok_or(LauncherConfigError::FetchError)?;
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
pub fn retrieve_custom_background_list(app: AppHandle) -> SJMCLResult<Vec<String>> {
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
  fs::copy(source_path, &dest_path)?;

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

#[tauri::command]
pub async fn retrieve_java_list(app: AppHandle) -> SJMCLResult<Vec<JavaInfo>> {
  refresh_and_update_javas(&app).await; // firstly refresh and update
  let binding = app.state::<Mutex<Vec<JavaInfo>>>();
  let state = binding.lock()?;
  Ok(state.clone())
}

#[tauri::command]
pub async fn validate_java(java_path: String) -> SJMCLResult<()> {
  if get_java_info_from_release_file(&java_path)
    .or_else(|| get_java_info_from_command(&java_path))
    .is_some()
  {
    Ok(())
  } else {
    Err(LauncherConfigError::JavaExecInvalid.into())
  }
}

#[tauri::command]
pub async fn check_game_directory(app: AppHandle, dir: String) -> SJMCLResult<String> {
  let local_game_directories: Vec<_>;
  {
    let binding = app.state::<Mutex<LauncherConfig>>();
    let state = binding.lock()?;
    local_game_directories = state.local_game_directories.clone();
  }
  let directory = PathBuf::from(&dir);

  if local_game_directories.iter().any(|d| d.dir == directory) {
    return Err(LauncherConfigError::GameDirAlreadyAdded.into());
  }
  if !directory.exists() {
    return Err(LauncherConfigError::GameDirNotExist.into());
  }

  if !refresh_instances(&GameDirectory {
    dir: directory.clone(),
    name: "".to_string(),
  })
  .await
  .unwrap_or_default()
  .is_empty()
  {
    return Ok("".to_string());
  }

  let sub_dirs = get_subdirectories(&directory).unwrap_or_default();
  for sub_dir in sub_dirs.into_iter().filter(|d| {
    matches!(
      d.file_name().and_then(|n| n.to_str()),
      Some(".minecraft") | Some("minecraft")
    )
  }) {
    if !refresh_instances(&GameDirectory {
      dir: sub_dir.clone(),
      name: "".to_string(),
    })
    .await
    .unwrap_or_default()
    .is_empty()
    {
      return Ok(sub_dir.to_str().unwrap().to_string());
    }
  }

  Ok("".to_string())
}

// Below are some system info commands (In frontend, see services/utils.ts)
#[tauri::command]
pub fn retrieve_memory_info() -> SJMCLResult<MemoryInfo> {
  Ok(get_memory_info())
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
