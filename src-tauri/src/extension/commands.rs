use crate::error::SJMCLResult;
use crate::extension::helper::{
  extract_extension_package, get_extensions_dir, read_extension_info,
};
use crate::extension::models::{ExtensionError, ExtensionInfo, ExtensionMetadata};
use crate::launcher_config::models::LauncherConfig;
use crate::storage::Storage;
use crate::utils::fs::get_subdirectories;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;
use uuid::Uuid;

#[tauri::command]
pub fn retrieve_extension_list(app: AppHandle) -> SJMCLResult<Vec<ExtensionInfo>> {
  let extensions_dir = get_extensions_dir(&app)?;
  if !extensions_dir.exists() {
    return Ok(Vec::new());
  }

  let mut extension_list: Vec<ExtensionInfo> = Vec::new();

  for sub_dir in get_subdirectories(extensions_dir)? {
    // skin hidden/system folders (and .installing-xxx)
    if sub_dir
      .file_name()
      .and_then(|name| name.to_str())
      .is_some_and(|name| name.starts_with('.'))
    {
      continue;
    }

    match read_extension_info(&sub_dir) {
      Ok(info) => extension_list.push(info),
      Err(error) => {
        log::warn!(
          "Skip invalid extension directory {:?}: {}",
          sub_dir,
          error.0
        )
      }
    }
  }

  extension_list.sort_by(|a, b| a.metadata.identifier.cmp(&b.metadata.identifier));
  Ok(extension_list)
}

#[tauri::command]
pub fn add_extension(app: AppHandle, path: String) -> SJMCLResult<ExtensionInfo> {
  let package_path = PathBuf::from(path);
  if !package_path.exists() || !package_path.is_file() {
    return Err(ExtensionError::ExtensionNotFound.into());
  }

  let extensions_dir = get_extensions_dir(&app)?;
  fs::create_dir_all(&extensions_dir)?;
  let temp_dir = extensions_dir.join(format!(".installing-{}", Uuid::new_v4()));
  fs::create_dir_all(&temp_dir)?;

  let register_result = (|| -> SJMCLResult<ExtensionInfo> {
    // extract extension package (zip), rename the folder to the identifer
    extract_extension_package(&package_path, &temp_dir)?;
    let info = read_extension_info(&temp_dir)?;
    let extension_dir = extensions_dir.join(&info.metadata.identifier);

    if extension_dir.exists() {
      return Err(ExtensionError::DuplicateIdentifier.into());
    }

    fs::rename(&temp_dir, &extension_dir)?;

    // enable the new extension by default
    let config_binding = app.state::<Mutex<LauncherConfig>>();
    let mut config_state = config_binding.lock()?;
    let mut enabled = config_state.extension.enabled.clone();
    if !enabled.iter().any(|id| id == &info.metadata.identifier) {
      enabled.push(info.metadata.identifier.clone());
    }
    config_state.partial_update(
      &app,
      "extension.enabled",
      &serde_json::to_string(&enabled).unwrap_or_default(),
    )?;
    config_state.save()?;

    Ok(info)
  })();

  if temp_dir.exists() {
    let _ = fs::remove_dir_all(&temp_dir);
  }

  register_result
}

#[tauri::command]
pub fn delete_extension(app: AppHandle, identifier: String) -> SJMCLResult<()> {
  ExtensionMetadata::validate_identifier(&identifier)?;
  let extension_dir = get_extensions_dir(&app)?.join(&identifier);

  if !extension_dir.exists() || !extension_dir.is_dir() {
    return Err(ExtensionError::ExtensionNotFound.into());
  }

  fs::remove_dir_all(extension_dir)?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;
  let enabled: Vec<String> = config_state
    .extension
    .enabled
    .iter()
    .filter(|id| *id != &identifier)
    .cloned()
    .collect();
  config_state.partial_update(
    &app,
    "extension.enabled",
    &serde_json::to_string(&enabled).unwrap_or_default(),
  )?;
  config_state.save()?;

  Ok(())
}
