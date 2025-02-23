use crate::error::SJMCLResult;
use crate::{storage::Storage, EXE_DIR};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

#[cfg(target_os = "windows")]
use std::error::Error;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use super::models::{GameDirectory, LauncherConfig};

impl Storage for LauncherConfig {
  fn file_path() -> PathBuf {
    EXE_DIR.join("sjmcl.conf.json")
  }
}

impl LauncherConfig {
  pub fn setup_with_app(&mut self, app: &AppHandle) -> SJMCLResult<()> {
    // same as lib.rs
    // TODO: unify version
    let is_dev = cfg!(debug_assertions);
    let version = if is_dev {
      "dev".to_string()
    } else {
      app.package_info().version.to_string()
    };

    // Set default download cache dir if not exists, create dir
    if self.download.cache.directory == PathBuf::default() {
      self.download.cache.directory = app
        .path()
        .resolve::<PathBuf>("Download".into(), BaseDirectory::AppCache)?;
    }
    if !self.download.cache.directory.exists() {
      fs::create_dir_all(&self.download.cache.directory)?;
    }

    // Set default local game directories
    if self.local_game_directories.is_empty() {
      self.local_game_directories = vec![
        GameDirectory {
          name: "CURRENT_DIR".to_string(),
          dir: PathBuf::default(),
        },
        get_official_minecraft_directory(app),
      ];
    }

    // Update CURRENT_DIR
    for game_dir in &mut self.local_game_directories {
      if game_dir.name == "CURRENT_DIR" {
        game_dir.dir = EXE_DIR.join(".minecraft");
        if !game_dir.dir.exists() {
          fs::create_dir(&game_dir.dir)?;
        }
      }
    }

    self.version = version.clone();
    Ok(())
  }
}

fn get_official_minecraft_directory(app: &AppHandle) -> GameDirectory {
  let minecraft_dir: PathBuf;

  #[cfg(target_os = "windows")]
  {
    // Windows: {FOLDERID_RoamingAppData}\.minecraft
    minecraft_dir = app
      .path()
      .resolve::<PathBuf>(".minecraft".into(), BaseDirectory::Data)
      .unwrap_or_else(|_| PathBuf::from(r"C:\Users\Default\AppData\Roaming\.minecraft"));
  }

  #[cfg(target_os = "macos")]
  {
    // macOS: ~/Library/Application Support/minecraft
    minecraft_dir = app
      .path()
      .resolve::<PathBuf>("minecraft".into(), BaseDirectory::Data)
      .unwrap_or_else(|_| PathBuf::from("/Users/Shared/Library/Application Support/minecraft"));
  }

  #[cfg(target_os = "linux")]
  {
    // Linux: ~/.minecraft
    minecraft_dir = app
      .path()
      .resolve::<PathBuf>(".minecraft".into(), BaseDirectory::Home)
      .unwrap_or_else(|_| PathBuf::from("/home/user/.minecraft"));
  }

  GameDirectory {
    name: "OFFICIAL_DIR".to_string(),
    dir: minecraft_dir,
  }
}

pub fn get_java_paths() -> Vec<String> {
  let mut paths = HashSet::new();

  // List java paths from System PATH variable
  #[cfg(target_os = "windows")]
  let command_output = Command::new("where")
    .arg("java")
    // See https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags
    .creation_flags(0x08000000) // CREATE_NO_WINDOW
    .output();

  #[cfg(any(target_os = "macos", target_os = "linux"))]
  let command_output = Command::new("which").args(["-a", "java"]).output();

  if let Ok(output) = command_output {
    if output.status.success() {
      let stdout = String::from_utf8_lossy(&output.stdout);
      for line in stdout.lines() {
        let path = line.trim();
        if path.is_empty() {
          continue;
        }
        if let Ok(resolved_path) = fs::canonicalize(path) {
          paths.insert(resolved_path.to_string_lossy().into_owned());
        }
      }
    }
  }

  // For windows, try to get java path from registry
  #[cfg(target_os = "windows")]
  {
    if let Ok(java_path) = get_java_path_from_windows_registry() {
      paths.insert(java_path);
    }
  }

  // For macOS, run "/usr/libexec/java_home -V" additionally
  #[cfg(target_os = "macos")]
  {
    if let Ok(output) = Command::new("/usr/libexec/java_home").arg("-V").output() {
      if output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        for line in stderr.lines() {
          let trimmed = line.trim();
          // Don't use `split_whitespace().last()` because the path may contain spaces.
          if let Some(idx) = trimmed.rfind('"') {
            let path_part = &trimmed[idx + 1..].trim();
            if !path_part.is_empty() {
              let java_bin = PathBuf::from(path_part).join("bin/java");
              if let Ok(resolved_path) = fs::canonicalize(java_bin) {
                paths.insert(resolved_path.to_string_lossy().into_owned());
              }
            }
          }
        }
      }
    }
  }

  // For Windows, remove "\\?\" prefix from paths
  #[cfg(target_os = "windows")]
  {
    paths
      .into_iter()
      .map(|path| path.trim_start_matches(r"\\?\").to_string())
      .collect()
  }

  #[cfg(not(target_os = "windows"))]
  {
    paths.into_iter().collect()
  }
}

// Get canonicalized java path from Windows registry
#[cfg(target_os = "windows")]
fn get_java_path_from_windows_registry() -> Result<String, Box<dyn Error>> {
  let hklm = winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE);
  let base_path = r"SOFTWARE\JavaSoft\Java Runtime Environment";
  let current_version: String = hklm.open_subkey(base_path)?.get_value("CurrentVersion")?;
  let java_home: String = hklm
    .open_subkey(format!(r"{}\{}", base_path, current_version))?
    .get_value("JavaHome")?;
  let java_bin = PathBuf::from(java_home).join(r"bin\java.exe");
  Ok(fs::canonicalize(java_bin)?.to_string_lossy().into_owned())
}

pub fn get_java_info_from_release_file(java_path: &str) -> Option<(String, String)> {
  // Typically, executable files are located in .../Home/bin/java, release file and bin folder are at the same level.
  let java_path_buf = PathBuf::from(java_path);
  let java_home = java_path_buf.parent()?.parent()?;
  let release_file = java_home.join("release");

  if !release_file.exists() {
    return None;
  }

  let content = fs::read_to_string(release_file).ok()?;
  let mut vendor = "Oracle Corporation".to_string();
  let mut full_version = "0".to_string();

  // Try to parse info from release file
  for line in content.lines() {
    if line.starts_with("JAVA_VERSION=") {
      let quoted = line.split('=').nth(1)?.trim().trim_matches('"');
      full_version = quoted.to_string();
    } else if line.starts_with("IMPLEMENTOR=") {
      let quoted = line.split('=').nth(1)?.trim().trim_matches('"');
      vendor = quoted.to_string();
    }
  }

  if full_version == "0" {
    None
  } else {
    Some((vendor, full_version))
  }
}

pub fn get_java_info_from_command(java_path: &str) -> Option<(String, String)> {
  // use "java -version" command to get info
  let output = Command::new(java_path).arg("-version").output().ok()?;

  if !output.status.success() {
    return None;
  }

  let stderr_bytes = output.stderr;
  let stderr_str = String::from_utf8_lossy(&stderr_bytes);
  let lines: Vec<&str> = stderr_str.lines().collect();

  let vendor = "Unknown".to_string();
  let mut full_version = "0".to_string();

  if let Some(first_line) = lines.first() {
    if first_line.contains("version") {
      if let Some(v) = first_line.split_whitespace().nth(2) {
        let cleaned = v.trim_matches('"');
        full_version = cleaned.to_string();
      }
    }
    // TODO: parse vendor from version command output
  }

  Some((vendor, full_version))
}

pub fn parse_java_major_version(full_version: &str) -> (i32, bool) {
  let major_version = if full_version.starts_with("1.") {
    // Java 1.x (e.g., 1.8 -> 8, 1.7 -> 7)
    full_version
      .split('.')
      .nth(1)
      .unwrap_or("0")
      .parse::<i32>()
      .unwrap_or(0)
  } else {
    // Java 9+
    full_version
      .split('.')
      .next()
      .unwrap_or("0")
      .parse::<i32>()
      .unwrap_or(0)
  };

  let is_lts = [8, 11, 17, 21, 25].contains(&major_version);
  (major_version, is_lts)
}
