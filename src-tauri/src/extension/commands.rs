use semver::Version;
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use sjmcl_types::storage::Storage;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
use uuid::Uuid;

use crate::extension::helper::{
  extract_extension_package, get_extensions_dir, read_extension_info, resolve_extension_root,
};
use crate::extension::models::{
  ExtensionError, ExtensionImportedFile, ExtensionInfo, ExtensionMetadata,
};
use crate::launcher_config::models::{BuildType, LauncherConfig};
use crate::utils::fs::get_subdirectories;

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

fn validate_relative_data_path(path: &Path) -> SJMCLResult<()> {
  if path.as_os_str().is_empty()
    || path.to_string_lossy().contains('\\')
    || path
      .components()
      .any(|component| !matches!(component, Component::Normal(_)))
  {
    return Err(SJMCLError("Invalid extension data path".to_string()));
  }
  Ok(())
}

fn overlay_window_prefix(extension_identifier: &str) -> String {
  let encoded = extension_identifier
    .chars()
    .map(|character| format!("{:x}", character as u32))
    .collect::<Vec<_>>()
    .join("-");
  format!("extension_overlay_{encoded}_")
}

#[cfg(test)]
mod tests {
  use super::validate_relative_data_path;
  use std::path::Path;

  #[test]
  fn accepts_nested_extension_data_path() {
    assert!(validate_relative_data_path(Path::new("imports/pet.sjpet")).is_ok());
  }

  #[test]
  fn rejects_empty_absolute_and_parent_paths() {
    assert!(validate_relative_data_path(Path::new("")).is_err());
    assert!(validate_relative_data_path(Path::new("../pet.sjpet")).is_err());
    assert!(validate_relative_data_path(Path::new("pets/../pet.sjpet")).is_err());
    assert!(validate_relative_data_path(Path::new("C:\\pet.sjpet")).is_err());
  }

  #[test]
  fn creates_stable_isolated_overlay_prefix() {
    assert_eq!(
      super::overlay_window_prefix("org.sjmcl.desktop_pet"),
      "extension_overlay_6f-72-67-2e-73-6a-6d-63-6c-2e-64-65-73-6b-74-6f-70-5f-70-65-74_"
    );
    assert_ne!(
      super::overlay_window_prefix("org.sjmcl.desktop_pet"),
      super::overlay_window_prefix("org_sjmcl_desktop_pet")
    );
  }
}

#[tauri::command]
pub fn import_extension_file(
  app: AppHandle,
  extension_identifier: String,
  source_path: String,
  target_path: String,
  allowed_extensions: Vec<String>,
  max_bytes: u64,
) -> SJMCLResult<ExtensionImportedFile> {
  ExtensionMetadata::validate_identifier(&extension_identifier)?;
  if allowed_extensions.is_empty() || max_bytes == 0 || max_bytes > 256 * 1024 * 1024 {
    return Err(SJMCLError(
      "Invalid extension file import options".to_string(),
    ));
  }

  let allowed_extensions: Vec<String> = allowed_extensions
    .into_iter()
    .map(|value| value.trim_start_matches('.').to_ascii_lowercase())
    .collect();
  if allowed_extensions
    .iter()
    .any(|value| value.is_empty() || !value.chars().all(|ch| ch.is_ascii_alphanumeric()))
  {
    return Err(SJMCLError("Invalid allowed file extension".to_string()));
  }

  let source = fs::canonicalize(source_path)?;
  let metadata = fs::metadata(&source)?;
  if !metadata.is_file() || metadata.len() > max_bytes {
    return Err(SJMCLError(
      "Selected file is not a file or exceeds the size limit".to_string(),
    ));
  }
  let source_extension = source
    .extension()
    .and_then(|value| value.to_str())
    .map(str::to_ascii_lowercase)
    .ok_or_else(|| SJMCLError("Selected file has no extension".to_string()))?;
  if !allowed_extensions.contains(&source_extension) {
    return Err(SJMCLError("Selected file type is not allowed".to_string()));
  }

  let relative_target = PathBuf::from(&target_path);
  validate_relative_data_path(&relative_target)?;
  let target_extension = relative_target
    .extension()
    .and_then(|value| value.to_str())
    .map(str::to_ascii_lowercase)
    .ok_or_else(|| SJMCLError("Import target has no extension".to_string()))?;
  if !allowed_extensions.contains(&target_extension) {
    return Err(SJMCLError("Import target type is not allowed".to_string()));
  }

  let extension_dir = get_extensions_dir(&app)?.join(&extension_identifier);
  let info = read_extension_info(&extension_dir)?;
  if info.metadata.identifier != extension_identifier {
    return Err(ExtensionError::IdentifierMismatch.into());
  }

  let target = extension_dir.join("data").join(&relative_target);
  if target.exists() {
    return Err(SJMCLError("Import target already exists".to_string()));
  }
  let parent = target
    .parent()
    .ok_or_else(|| SJMCLError("Invalid import target".to_string()))?;
  fs::create_dir_all(parent)?;
  let temporary = parent.join(format!(".importing-{}", Uuid::new_v4()));
  let import_result = (|| -> SJMCLResult<()> {
    fs::copy(&source, &temporary)?;
    fs::rename(&temporary, &target)?;
    Ok(())
  })();
  if import_result.is_err() && temporary.exists() {
    let _ = fs::remove_file(&temporary);
  }
  import_result?;

  Ok(ExtensionImportedFile {
    name: source
      .file_name()
      .and_then(|value| value.to_str())
      .unwrap_or_default()
      .to_string(),
    path: target_path,
    size: metadata.len(),
  })
}

#[tauri::command]
pub fn open_extension_file(
  app: AppHandle,
  extension_identifier: String,
  relative_path: String,
) -> SJMCLResult<()> {
  ExtensionMetadata::validate_identifier(&extension_identifier)?;
  let relative_path = PathBuf::from(relative_path);
  validate_relative_data_path(&relative_path)?;
  if relative_path
    .extension()
    .and_then(|value| value.to_str())
    .is_none_or(|extension| !extension.eq_ignore_ascii_case("txt"))
  {
    return Err(SJMCLError(
      "Only extension text documents can be opened".to_string(),
    ));
  }

  let extension_dir = get_extensions_dir(&app)?.join(&extension_identifier);
  let info = read_extension_info(&extension_dir)?;
  if info.metadata.identifier != extension_identifier {
    return Err(ExtensionError::IdentifierMismatch.into());
  }
  let extension_root = fs::canonicalize(extension_dir)?;
  let document_path = fs::canonicalize(extension_root.join(relative_path))?;
  if !document_path.starts_with(&extension_root) || !document_path.is_file() {
    return Err(SJMCLError("Invalid extension document path".to_string()));
  }

  app
    .opener()
    .open_path(document_path.to_string_lossy().into_owned(), None::<&str>)
    .map_err(SJMCLError::from)
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

    // check required minimal launcher version (only for release builds)
    {
      let config_binding = app.state::<Mutex<LauncherConfig>>();
      let config_state = config_binding.lock()?;
      if config_state.basic_info.build_type == BuildType::Release {
        let current_version = Version::parse(&config_state.basic_info.launcher_version)
          .unwrap_or_else(|_| app.package_info().version.clone());
        let required_version = info
          .metadata
          .minimal_launcher_version
          .as_deref()
          .and_then(|v| Version::parse(v).ok())
          .unwrap_or_else(|| Version::new(1, 0, 0));
        if current_version < required_version {
          return Err(ExtensionError::LauncherVersionTooLow.into());
        }
      }
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

  if register_result.is_err()
    && temp_dir.exists()
    && let Err(cleanup_error) = fs::remove_dir_all(&temp_dir)
  {
    log::warn!(
      "Failed to cleanup temporary extension directory {:?}: {}",
      temp_dir,
      cleanup_error
    );
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

  let overlay_prefix = overlay_window_prefix(&identifier);
  for window in app
    .webview_windows()
    .into_values()
    .filter(|window| window.label().starts_with(&overlay_prefix))
  {
    if let Err(error) = window.close() {
      log::warn!(
        "Failed to close overlay window {} before deleting extension {}: {}",
        window.label(),
        identifier,
        error
      );
    }
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
