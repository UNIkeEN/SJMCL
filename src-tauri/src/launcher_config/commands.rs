use super::helpers::java::{
  get_java_info_from_command, get_java_info_from_release_file, refresh_and_update_javas,
};
use super::models::{GameDirectory, JavaInfo, LauncherConfig, LauncherConfigError};
use crate::error::SJMCLResult;
use crate::instance::helpers::misc::refresh_instances;
use crate::storage::Storage;
use crate::tasks::monitor::TaskMonitor;
use crate::utils::fs::{generate_unique_filename, get_subdirectories};
use crate::utils::string::camel_to_snake_case;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

#[tauri::command]
pub fn retrieve_launcher_config(app: AppHandle) -> SJMCLResult<LauncherConfig> {
  let binding = app.state::<Mutex<LauncherConfig>>();
  let state = binding.lock()?;
  Ok(state.clone())
}

#[tauri::command]
pub fn update_launcher_config(app: AppHandle, key_path: String, value: String) -> SJMCLResult<()> {
  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;
  let key_path = camel_to_snake_case(key_path.as_str());
  config_state.partial_update(&app, &key_path, &value)?;
  config_state.save()?;
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
    .json(&json!({
      "version": app.package_info().version.to_string(),
      "json_data": state,
    }))
    .send()
    .await
  {
    Ok(response) => {
      let status = response.status();
      let json: Value = response
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
    .json(&json!({
      "version": app.package_info().version.to_string(),
      "code": code,
    }))
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
  let dest_path = generate_unique_filename(&custom_bg_dir, file_name);
  fs::copy(source_path, &dest_path)?;

  Ok(dest_path.file_name().unwrap().to_string_lossy().to_string())
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

  if !refresh_instances(
    &app,
    &GameDirectory {
      dir: directory.clone(),
      name: "".to_string(),
    },
    false,
  )
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
    if !refresh_instances(
      &app,
      &GameDirectory {
        dir: sub_dir.clone(),
        name: "".to_string(),
      },
      false,
    )
    .await
    .unwrap_or_default()
    .is_empty()
    {
      return Ok(sub_dir.to_str().unwrap().to_string());
    }
  }

  Ok("".to_string())
}

#[tauri::command]
pub async fn clear_download_cache(app: AppHandle) -> SJMCLResult<()> {
  let launcher_config = app.state::<Mutex<LauncherConfig>>();
  let monitor = app.state::<Pin<Box<TaskMonitor>>>();

  if monitor.has_active_download_tasks() {
    return Err(LauncherConfigError::HasActiveDownloadTasks.into());
  }

  let cache_path = {
    let config = launcher_config.lock()?;
    config.download.cache.directory.clone()
  };

  std::fs::remove_dir_all(&cache_path).map_err(|_| LauncherConfigError::FileDeletionFailed)?;
  // recreate the cache directory
  std::fs::create_dir_all(&cache_path).map_err(|_| LauncherConfigError::FileDeletionFailed)?;

  Ok(())
}
