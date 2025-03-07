use super::{
  helpers::{
    get_java_info_from_command, get_java_info_from_release_file, get_java_paths,
    parse_java_major_version,
  },
  models::{GameDirectory, JavaInfo, LauncherConfig, LauncherConfigError, MemoryInfo},
};
use crate::{
  error::SJMCLResult, instance::helpers::misc::refresh_instances, partial::PartialUpdate,
};
use crate::{storage::Storage, utils::path::get_subdirectories};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use systemstat::{saturating_sub_bytes, Platform};
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
  let binding = app.state::<Mutex<LauncherConfig>>();
  let mut state = binding.lock()?;
  let mut snake = String::new();
  for (i, ch) in key_path.char_indices() {
    if i > 0 && ch.is_uppercase() {
      snake.push('_');
    }
    snake.push(ch.to_ascii_lowercase());
  }
  state.update(&snake, &value)?;
  state.save()?;
  Ok(())
}

#[tauri::command]
pub fn restore_launcher_config(app: AppHandle) -> SJMCLResult<LauncherConfig> {
  let mut default_config = LauncherConfig::default();
  default_config.setup_with_app(&app)?;

  let binding = app.state::<Mutex<LauncherConfig>>();
  let mut state = binding.lock()?;
  *state = default_config;
  state.save()?;
  Ok(state.clone())
}

#[tauri::command]
pub async fn export_launcher_config(app: AppHandle) -> SJMCLResult<String> {
  let binding = app.state::<Mutex<LauncherConfig>>();
  let state = { binding.lock()?.clone() };
  let client = reqwest::Client::new();
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
        let binding = app.state::<Mutex<LauncherConfig>>();
        let mut state = binding.lock()?;
        *state = serde_json::from_value(json).map_err(|_| LauncherConfigError::FetchError)?;
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
pub fn retrieve_memory_info() -> SJMCLResult<MemoryInfo> {
  let sys = systemstat::System::new();
  let mem = sys.memory()?;
  Ok(MemoryInfo {
    total: mem.total.as_u64(),
    used: saturating_sub_bytes(mem.total, mem.free).as_u64(),
  })
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
pub fn retrieve_java_list() -> SJMCLResult<Vec<JavaInfo>> {
  let java_paths = get_java_paths();
  let mut java_list = Vec::new();

  for java_exec_path in java_paths {
    let java_path_buf = PathBuf::from(&java_exec_path);

    let (vendor, full_version) = match get_java_info_from_release_file(&java_exec_path)
      .or_else(|| get_java_info_from_command(&java_exec_path))
    {
      Some(info) => info,
      None => continue,
    };

    let java_bin_path = java_path_buf
      .parent()
      .unwrap_or_else(|| Path::new(""))
      .to_path_buf();

    #[cfg(target_os = "windows")]
    let is_jdk = java_bin_path.join("javac.exe").exists();

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    let is_jdk = java_bin_path.join("javac").exists();

    let (major_version, is_lts) = parse_java_major_version(&full_version);

    java_list.push(JavaInfo {
      name: format!("{} {}", if is_jdk { "JDK" } else { "JRE" }, full_version),
      major_version,
      is_lts,
      exec_path: java_exec_path,
      vendor,
    });
  }

  java_list.sort_by(|a, b| {
    b.major_version
      .cmp(&a.major_version)
      .then_with(|| a.exec_path.len().cmp(&b.exec_path.len()))
  });

  Ok(java_list)
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
