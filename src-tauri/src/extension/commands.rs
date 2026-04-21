use crate::error::SJMCLResult;
use crate::extension::helper::{
  extract_extension_package, get_extensions_dir, read_extension_info, resolve_extension_root,
};
use crate::extension::models::{ExtensionError, ExtensionInfo, ExtensionMetadata};
use crate::launcher_config::models::LauncherConfig;
use crate::storage::Storage;
use crate::utils::fs::get_subdirectories;
use semver::Version;
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
    // skip hidden/system folders (and .installing-xxx)
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
pub fn add_extension(
  app: AppHandle,
  path: String,
  expected_identifier: Option<String>,
) -> SJMCLResult<ExtensionInfo> {
  let package_path = PathBuf::from(path);
  if !package_path.exists() || !package_path.is_file() {
    return Err(ExtensionError::ExtensionNotFound.into());
  }

  let extensions_dir = get_extensions_dir(&app)?;
  fs::create_dir_all(&extensions_dir)?;
  let temp_dir = extensions_dir.join(format!(".installing-{}", Uuid::new_v4()));
  fs::create_dir_all(&temp_dir)?;

  let register_result = (|| -> SJMCLResult<ExtensionInfo> {
    // extract extension package (zip) and read metadata
    extract_extension_package(&package_path, &temp_dir)?;
    let install_dir = resolve_extension_root(&temp_dir)?;
    let info = read_extension_info(&install_dir)?;

    // if expected identifier is provided, validate it with the one in metadata (for extension update scenario)
    if let Some(identifier) = expected_identifier.as_deref() {
      ExtensionMetadata::validate_identifier(identifier)?;
      if identifier != info.metadata.identifier {
        return Err(ExtensionError::IdentifierMismatch.into());
      }
    }

    // check required minimal launcher version
    let minimal_launcher_version = Version::parse(
      info
        .metadata
        .minimal_launcher_version
        .as_deref()
        .unwrap_or("0.0.0"),
    )
    .unwrap();
    if app.package_info().version < minimal_launcher_version {
      return Err(ExtensionError::LauncherVersionTooLow.into());
    }

    let extension_dir = extensions_dir.join(&info.metadata.identifier);
    let backup_dir = extensions_dir.join(format!(".backup-{}", Uuid::new_v4()));
    // Existing file/folder with the same name(identifier), replace it directly(w/o existing data folder).
    if extension_dir.exists() {
      if extension_dir.is_dir() {
        fs::rename(&extension_dir, &backup_dir)?;
        fs::rename(&install_dir, &extension_dir)?;

        let existing_data_dir = backup_dir.join("data");
        if existing_data_dir.exists() && existing_data_dir.is_dir() {
          let incoming_data_dir = extension_dir.join("data");
          if incoming_data_dir.exists() {
            fs::remove_dir_all(&incoming_data_dir)?;
          }
          fs::rename(&existing_data_dir, &incoming_data_dir)?;
        }

        fs::remove_dir_all(&backup_dir)?;
      } else {
        fs::remove_file(&extension_dir)?;
        fs::rename(&install_dir, &extension_dir)?;
      }
    } else {
      fs::rename(&install_dir, &extension_dir)?;
    }
    if temp_dir.exists() {
      fs::remove_dir_all(&temp_dir)?;
    }

    // dont enable the new extension by default (user will manually enable it with a security confirm dialog)

    // let config_binding = app.state::<Mutex<LauncherConfig>>();
    // let mut config_state = config_binding.lock()?;
    // let mut enabled = config_state.extension.enabled.clone();
    // if !enabled.iter().any(|id| id == &info.metadata.identifier) {
    //   enabled.push(info.metadata.identifier.clone());
    // }
    // config_state.partial_update(
    //   &app,
    //   "extension.enabled",
    //   &serde_json::to_string(&enabled).unwrap_or_default(),
    // )?;
    // config_state.save()?;

    Ok(info)
  })();

  if register_result.is_err() && temp_dir.exists() {
    if let Err(cleanup_error) = fs::remove_dir_all(&temp_dir) {
      log::warn!(
        "Failed to cleanup temporary extension directory {:?}: {}",
        temp_dir,
        cleanup_error
      );
    }
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

  // update related fields in config: enabled list and home widget state
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

  let home_widget_prefix = format!("{identifier}:home_widget");
  let home_widget_state: Vec<(String, u32, bool)> = config_state
    .extension
    .home_widget_state
    .iter()
    .filter(|(widget_identifier, _, _)| !widget_identifier.starts_with(&home_widget_prefix))
    .cloned()
    .collect();
  config_state.partial_update(
    &app,
    "extension.home_widget_state",
    &serde_json::to_string(&home_widget_state).unwrap_or_default(),
  )?;
  config_state.save()?;

  Ok(())
}
