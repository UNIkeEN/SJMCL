use crate::error::{SJMCLError, SJMCLResult};
use crate::IS_PORTABLE;
use regex::Regex;
use sha1::{Digest, Sha1};
use sha2::Sha256;
use std::ffi::OsStr;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::{fs, io};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use zip::write::{ExtendedFileOptions, FileOptions};
use zip::{CompressionMethod, ZipWriter};

/// Recursively copies the contents of a source directory to a destination directory.
///
/// # Examples
///
/// ```rust
/// copy_whole_dir(src_path, &dest_path).map_err(|_| InstanceError::FileCopyFailed)?;
/// ```
pub fn copy_whole_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
  if !dst.exists() {
    fs::create_dir_all(dst)?;
  }

  for entry in fs::read_dir(src)? {
    let entry = entry?;
    let entry_path = entry.path();
    let dest_path = dst.join(entry.file_name());

    if entry_path.is_dir() {
      copy_whole_dir(&entry_path, &dest_path)?;
    } else {
      fs::copy(&entry_path, &dest_path)?;
    }
  }
  Ok(())
}

/// Generates a unique filename in the specified directory.
///
/// If a file with the same name already exists, appends `" copy"`, `" copy 2"`, `" copy 3"`
/// and so on until a non-conflicting name is found.
///
/// # Examples
///
/// ```rust
/// let dest_path = generate_unique_filename(&tgt_path, base_name);
/// ```
pub fn generate_unique_filename(base_path: &Path, filename: &OsStr) -> PathBuf {
  let (name, extension) = split_filename(filename);
  let mut dest_path = base_path.join(filename);
  let mut counter = 1;

  while dest_path.exists() {
    let new_filename = format!(
      "{} copy{}",
      name,
      if counter > 1 {
        format!(" {}", counter)
      } else {
        String::new()
      }
    );

    let new_filename = if !extension.is_empty() {
      format!("{}.{}", new_filename, extension)
    } else {
      new_filename
    };

    dest_path = base_path.join(new_filename);
    counter += 1;
  }

  dest_path
}

/// Splits a filename into its base name and extension.
///
/// # Examples
///
/// ```rust
/// let (name, extension) = split_filename(filename);
/// ```
pub fn split_filename(filename: &OsStr) -> (String, String) {
  let filename_str = filename.to_string_lossy();
  if let Some(dot_index) = filename_str.rfind('.') {
    let name = filename_str[..dot_index].to_string();
    let extension = filename_str[dot_index + 1..].to_string();
    (name, extension)
  } else {
    (filename_str.to_string(), String::new())
  }
}

/// Extracts the file name or file stem from a given path string.
///
/// # Arguments
///
/// * `path_str` - A string slice representing the file path.
/// * `with_ext` - If true, returns the file name with extension; otherwise, returns only the file stem.
///
/// # Return
///
/// A `String` containing either the full file name or just the stem (without extension).
pub fn extract_filename(path_str: &str, with_ext: bool) -> String {
  let path = Path::new(path_str);
  if with_ext {
    path
      .file_name()
      .and_then(|name| name.to_str())
      .unwrap_or("")
      .to_string()
  } else {
    path
      .file_stem()
      .and_then(|stem| stem.to_str())
      .unwrap_or("")
      .to_string()
  }
}

/// Retrieves a list of subdirectories within a given path.
///
/// # Examples
///
/// ```rust
/// let sub_dirs = get_subdirectories(&directory).unwrap_or_default();
/// ```
pub fn get_subdirectories<P: AsRef<Path>>(path: P) -> SJMCLResult<Vec<PathBuf>> {
  fs::read_dir(path)?
    .filter_map(|entry| match entry {
      Ok(entry) => {
        if let Ok(file_type) = entry.file_type() {
          if file_type.is_dir() {
            return Some(Ok(entry.path()));
          }
        }
        None
      }
      Err(e) => Some(Err(SJMCLError(format!("Entry Error: {}", e)))),
    })
    .collect()
}

/// Retrieves a list of files within a given path that match a specified regular expression.
///
/// # Examples
///
/// ```rust
/// let mod_paths = get_files_with_regex(&mods_dir, &valid_extensions).unwrap_or_default();
/// ```
pub fn get_files_with_regex<P: AsRef<Path>>(path: P, pattern: &Regex) -> SJMCLResult<Vec<PathBuf>> {
  let dir_entries = fs::read_dir(&path).map_err(|e| {
    let error_message = match e.kind() {
      io::ErrorKind::NotFound => "Path does not exist".to_string(),
      _ => format!("IO Error: {}", e),
    };
    SJMCLError(error_message)
  })?;

  let mut matching_files = Vec::new();

  for entry in dir_entries {
    let entry = entry.map_err(|e| SJMCLError(format!("Read Entry Error: {}", e)))?;
    let path = entry.path();

    if let Some(file_name) = path.file_name() {
      if let Some(file_name_str) = file_name.to_str() {
        if pattern.is_match(file_name_str) {
          matching_files.push(path);
        }
      }
    }
  }

  Ok(matching_files)
}

/// Retrieves the full filesystem path to an application resource, choosing between
/// the embedded `Resource` directory or the extracted `AppData` directory based on
/// whether the app is running in “portable” mode.
///
/// # Arguments
///
/// * `app`: Tauri AppHandle
/// * `relative_path`: The resource’s relative path
///
/// # Example
///
/// ```rust
/// let texture_path = get_app_resource(&app, "assets/skins/player.png")?;
/// println!("Texture will be loaded from: {:?}", texture_path);
/// ```
pub fn get_app_resource_filepath(
  app: &AppHandle,
  relative_path: &str,
) -> Result<PathBuf, io::Error> {
  let dir = if *IS_PORTABLE {
    BaseDirectory::AppData
  } else {
    BaseDirectory::Resource
  };

  app
    .path()
    .resolve(relative_path, dir)
    .map_err(io::Error::other)
}

/// Creates a cross-platform desktop shortcut that points to a URL (include deeplink).
///
/// Supports:
/// - Windows (`.url`) with `.ico` icon
/// - Linux (`.desktop`) with `.png` icon
/// - macOS (`.webloc`), icon not supported
///
/// If `icon_path` is `None`, a default icon is copied from the app's resources to `AppData`,
/// and used in the shortcut (except on macOS).
///
/// # Arguments
///
/// - `app`: Tauri AppHandle
/// - `name`: File name (without extension)
/// - `url`: Target deeplink or custom URL (e.g. `sjmcl://...`)
/// - `icon_path`: Optional icon override
///
/// # Examples
///
/// ```rust
/// create_url_shortcut(
///     app,
///     "Add Auth Server".to_string(),
///     "sjmcl://add-auth-server?url=https%3A%2F%2Fexample.com".to_string(),
///     None,
/// )?;
///
/// create_url_shortcut(
///     app,
///     "Launch".to_string(),
///     "sjmcl://launch?id=OFFICIAL_DIR:1.20.1".to_string(),
///     Some(PathBuf::from("/path/to/custom/icon.png")),
/// )?;
/// ```
pub fn create_url_shortcut(
  app: &AppHandle,
  name: String,
  url: String,
  icon_path: Option<PathBuf>,
) -> SJMCLResult<()> {
  let desktop = app
    .path()
    .desktop_dir()
    .map_err(|e| SJMCLError(format!("Failed to get desktop path: {}", e)))?;

  #[cfg(target_os = "windows")]
  let shortcut_ext = "url";
  #[cfg(target_os = "macos")]
  let shortcut_ext = "command";
  // let shortcut_ext = "webloc";
  #[cfg(target_os = "linux")]
  let shortcut_ext = "desktop";

  let path = desktop.join(format!("{}.{}", name, shortcut_ext));

  // process icon, use SJMCL icon as default (macOS webloc does not support icon)
  #[cfg(target_os = "macos")]
  {
    let _ = icon_path; // suppress unused warning of params
  }
  #[cfg(any(target_os = "windows", target_os = "linux"))]
  let final_icon_path: PathBuf = match icon_path {
    Some(path) => path,
    None => {
      // Use default icon from resources
      #[cfg(target_os = "windows")]
      let icon_name = "icon.ico";
      #[cfg(target_os = "linux")]
      let icon_name = "icon.png";

      let resource_icon = get_app_resource_filepath(app, &format!("assets/icons/{}", icon_name))
        .map_err(|e| SJMCLError(format!("Failed to resolve resource icon: {}", e)))?;

      let appdata_icon = app
        .path()
        .resolve(icon_name, BaseDirectory::AppData)
        .map_err(|e| SJMCLError(format!("Failed to resolve appdata icon path: {}", e)))?;

      fs::copy(&resource_icon, &appdata_icon)
        .map_err(|e| SJMCLError(format!("Failed to copy default icon: {}", e)))?;

      appdata_icon
    }
  };

  // Platform-specific shortcut creation
  #[cfg(target_os = "windows")]
  {
    let icon_line = format!("IconFile={}", final_icon_path.to_string_lossy());
    let content = format!(
      "[InternetShortcut]\nURL={}\n{}\nIconIndex=0\n",
      url, icon_line
    );

    fs::write(&path, content).map_err(|e| SJMCLError(e.to_string()))?;
  }

  // #[cfg(target_os = "macos")]
  // {
  //   use plist::{Dictionary, Value};

  //   let mut dict = Dictionary::new();
  //   dict.insert("URL".to_string(), Value::String(url.to_string()));
  //   let plist_value = Value::Dictionary(dict);

  //   let file = fs::File::create(&path).map_err(|e| SJMCLError(e.to_string()))?;
  //   plist_value.to_writer_xml(file).map_err(|e| SJMCLError(e.to_string()))?;
  // }

  #[cfg(target_os = "macos")]
  {
    use std::io::Write;
    use std::os::unix::fs::PermissionsExt;

    let content = format!("#!/bin/bash\nopen \"{}\"\n", url);

    let mut file = fs::File::create(&path).map_err(|e| SJMCLError(e.to_string()))?;
    file
      .write_all(content.as_bytes())
      .map_err(|e| SJMCLError(e.to_string()))?;

    let mut perms = file
      .metadata()
      .map_err(|e| SJMCLError(e.to_string()))?
      .permissions();
    perms.set_mode(0o755);
    fs::set_permissions(&path, perms).map_err(|e| SJMCLError(e.to_string()))?;
  }

  #[cfg(target_os = "linux")]
  {
    use std::io::Write;
    use std::os::unix::fs::PermissionsExt;

    let icon_line = format!("Icon={}", final_icon_path.to_string_lossy());

    let content = format!(
      "[Desktop Entry]
Type=Application
Name={}
Exec=xdg-open {}
{}
Terminal=false
",
      name, url, icon_line
    );

    let mut file = fs::File::create(&path).map_err(|e| SJMCLError(e.to_string()))?;
    file
      .write_all(content.as_bytes())
      .map_err(|e| SJMCLError(e.to_string()))?;

    let mut perms = file
      .metadata()
      .map_err(|e| SJMCLError(e.to_string()))?
      .permissions();
    perms.set_mode(0o755);
    fs::set_permissions(&path, perms).map_err(|e| SJMCLError(e.to_string()))?;
  }

  Ok(())
}

pub fn validate_sha1(dest_path: PathBuf, truth: String) -> SJMCLResult<()> {
  let mut f = std::fs::File::options()
    .read(true)
    .create(false)
    .write(false)
    .open(&dest_path)
    .map_err(|e| {
      SJMCLError(format!(
        "Failed to open file {}: {}",
        dest_path.display(),
        e
      ))
    })?;
  let mut hasher = Sha1::new();
  std::io::copy(&mut f, &mut hasher)
    .map_err(|e| SJMCLError(format!("Failed to copy data for SHA1 validation: {}", e)))?;

  let sha1 = hex::encode(hasher.finalize());
  if sha1 != truth {
    Err(SJMCLError(format!(
      "SHA1 mismatch for {}: expected {}, got {}",
      dest_path.display(),
      truth,
      sha1
    )))
  } else {
    Ok(())
  }
}

/// Calculates the SHA256 hash of a file.
///
/// # Parameters
/// - `path`: The file path to hash
///
/// # Returns
/// - `SJMCLResult<String>`: The SHA256 hash as a hexadecimal string, or an error
pub fn calculate_sha256(path: &Path) -> SJMCLResult<String> {
  match std::fs::File::open(path) {
    Ok(mut file) => {
      let mut hasher = Sha256::new();
      // Use an 8 KiB buffer as a common compromise between memory usage and I/O throughput.
      let mut buffer = [0; 8192];

      loop {
        match file.read(&mut buffer) {
          Ok(0) => break,
          Ok(n) => hasher.update(&buffer[..n]),
          Err(e) => {
            return Err(SJMCLError(format!(
              "Error reading file {} for hashing: {}",
              path.display(),
              e
            )));
          }
        }
      }

      Ok(format!("{:x}", hasher.finalize()))
    }
    Err(e) => Err(SJMCLError(format!(
      "Failed to open file {} for hashing: {}",
      path.display(),
      e
    ))),
  }
}

pub fn create_zip_from_dirs(paths: Vec<PathBuf>, zip_file_path: PathBuf) -> SJMCLResult<String> {
  let zip_file = std::fs::File::create(&zip_file_path)
    .map_err(|e| SJMCLError(format!("Failed to create zip file: {}", e)))?;
  let mut zip = ZipWriter::new(zip_file);
  let options = FileOptions::<ExtendedFileOptions>::default()
    .compression_method(CompressionMethod::Deflated)
    .unix_permissions(0o755);

  for path in paths {
    if path.is_file() {
      let file_name = path.file_name().and_then(OsStr::to_str).unwrap_or_default();
      zip.start_file(file_name, options.clone())?;
      let mut file = std::fs::File::open(&path)
        .map_err(|e| SJMCLError(format!("Failed to open file {}: {}", path.display(), e)))?;
      std::io::copy(&mut file, &mut zip)
        .map_err(|e| SJMCLError(format!("Failed to copy data to zip: {}", e)))?;
    }
  }

  zip
    .finish()
    .map_err(|e| SJMCLError(format!("Failed to finalize zip file: {}", e)))?;

  Ok(zip_file_path.to_string_lossy().to_string())
}

/// Enum to define the permission operation
#[derive(Debug)]
pub enum PermissionOperation {
  Upgrade,
  Downgrade,
  Exact,
}

/// Modify file permissions for UNIX-like systems (Linux/macOS).
///
/// # Parameters:
/// - `path`: The path to the file whose permissions are being modified.
/// - `perm_mask`: The permission mask (e.g., `0o111` for execute permissions).
/// - `operation`: The operation to perform:
///     - `PermissionOperation::Upgrade` adds permissions if missing,
///     - `PermissionOperation::Downgrade` removes permissions if present,
///     - `PermissionOperation::Exact` sets the permissions exactly to the specified mask.
///
/// # Examples
/// ```rust
/// manage_permissions_unix("/path/to/your/file", 0o111, PermissionOperation::Upgrade)?;
/// manage_permissions_unix("/path/to/your/file", 0o111, PermissionOperation::Downgrade)?;
/// manage_permissions_unix("/path/to/your/file", 0o755, PermissionOperation::Exact)?;
/// ```
pub fn manage_permissions_unix<P>(
  path: P,
  perm_mask: u32,
  operation: PermissionOperation,
) -> SJMCLResult<()>
where
  P: AsRef<Path>,
{
  #[cfg(target_os = "windows")]
  {
    // On Windows, simply return Ok(()) since no changes are made
    return Ok(());
  }

  #[cfg(any(target_os = "linux", target_os = "macos"))]
  {
    use std::os::unix::fs::PermissionsExt;

    let metadata = fs::metadata(&path)?;
    let mut permissions = metadata.permissions();
    let current_mode = permissions.mode();

    match operation {
      PermissionOperation::Upgrade => {
        // "upgrade" operation: only add the permissions if they are missing
        if current_mode & perm_mask != perm_mask {
          let new_mode = current_mode | perm_mask;
          permissions.set_mode(new_mode);
          fs::set_permissions(&path, permissions)?;
          log::info!("Upgraded permissions for {}", path.as_ref().display());
        } else {
          log::info!("No upgrade needed for {}", path.as_ref().display());
        }
      }
      PermissionOperation::Downgrade => {
        // "downgrade" operation: only remove the permissions if they are present
        if current_mode & perm_mask != 0 {
          let new_mode = current_mode & !perm_mask; // Clear the respective permission
          permissions.set_mode(new_mode);
          fs::set_permissions(&path, permissions)?;
          log::info!("Downgraded permissions for {}", path.as_ref().display());
        } else {
          log::info!("No downgrade needed for {}", path.as_ref().display());
        }
      }
      PermissionOperation::Exact => {
        // "exact" operation: set the permissions exactly to the specified mask
        permissions.set_mode(perm_mask);
        fs::set_permissions(&path, permissions)?;
        log::info!("Set exact permissions for {}", path.as_ref().display());
      }
    }
  }

  Ok(())
}
