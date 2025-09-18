use crate::{
  error::SJMCLResult,
  launcher_config::{
    commands::retrieve_custom_background_list,
    models::{BasicInfo, GameConfig, GameDirectory, LauncherConfig},
  },
  partial::{PartialAccess, PartialUpdate},
  utils::portable::extract_assets,
  APP_DATA_DIR, IS_PORTABLE,
};
use rand::Rng;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

fn ensure_writable_directory(app: &AppHandle, preferred_path: PathBuf) -> SJMCLResult<PathBuf> {
  // Try the preferred path first
  if preferred_path.exists() || fs::create_dir_all(&preferred_path).is_ok() {
    let test_file = preferred_path.join(".write_test");
    if fs::write(&test_file, b"test").is_ok() {
      let _ = fs::remove_file(&test_file);
      return Ok(preferred_path);
    }
  }

  // Fallback strategies based on portable mode
  let fallback_paths = if *IS_PORTABLE {
    vec![
      crate::EXE_DIR.join("Download"),
      std::env::temp_dir().join("SJMCL").join("Download"),
    ]
  } else {
    let mut paths = vec![];

    // Try app cache directory
    if let Ok(cache_dir) = app
      .path()
      .resolve::<PathBuf>("Download".into(), BaseDirectory::AppCache)
    {
      paths.push(cache_dir);
    }

    // Platform-specific temp directories
    if cfg!(target_os = "windows") {
      paths.push(std::env::temp_dir().join("SJMCL").join("Download"));
    } else {
      paths.push(PathBuf::from("/tmp/SJMCL/Download"));
    }

    paths
  };

  // Try each fallback path
  for fallback_path in fallback_paths {
    if fs::create_dir_all(&fallback_path).is_ok() {
      let test_file = fallback_path.join(".write_test");
      if fs::write(&test_file, b"test").is_ok() {
        let _ = fs::remove_file(&test_file);
        return Ok(fallback_path);
      }
    }
  }

  Err(crate::error::SJMCLError("No writable directory found for download cache".to_string()).into())
}

impl LauncherConfig {
  pub fn setup_with_app(&mut self, app: &AppHandle) -> SJMCLResult<()> {
    // same as lib.rs
    let is_dev = cfg!(debug_assertions);
    let version = match (is_dev, app.package_info().version.to_string().as_str()) {
      (true, _) => "dev".to_string(),
      (false, "0.0.0") => "nightly".to_string(),
      (false, v) => v.to_string(),
    };

    // Set default download cache dir if not exists, create dir
    let default_cache_dir = if self.download.cache.directory == PathBuf::default() {
      app
        .path()
        .resolve::<PathBuf>("Download".into(), BaseDirectory::AppCache)?
    } else {
      self.download.cache.directory.clone()
    };

    // Ensure we have a writable download cache directory
    self.download.cache.directory = ensure_writable_directory(app, default_cache_dir)?;

    // Random pick custom background image if enabled
    if self.appearance.background.random_custom {
      let app_handle = app.clone();
      match retrieve_custom_background_list(app_handle) {
        Ok(backgrounds) if !backgrounds.is_empty() => {
          let mut rng = rand::rng();
          let random_index = rng.random_range(0..backgrounds.len());
          self.appearance.background.choice = backgrounds[random_index].clone();
        }
        _ => {
          self.appearance.background.random_custom = false;
        }
      }
    }

    // Set default local game directories
    if self.local_game_directories.is_empty() {
      let mut dirs = Vec::new();

      #[cfg(target_os = "macos")]
      {
        if let Some(app_data_dir) = APP_DATA_DIR.get() {
          let app_data_subdir = app_data_dir.join("minecraft");
          dirs.push(GameDirectory {
            name: "APP_DATA_SUBDIR".to_string(),
            dir: app_data_subdir,
          });
        }
      }

      #[cfg(not(target_os = "macos"))]
      {
        if *IS_PORTABLE || cfg!(debug_assertions) {
          dirs.push(GameDirectory {
            name: "CURRENT_DIR".to_string(),
            dir: PathBuf::new(), // place holder, will be set later
          });
        } else {
          dirs.push(GameDirectory {
            name: "APP_DATA_SUBDIR".to_string(),
            dir: APP_DATA_DIR.get().unwrap().join(".minecraft"),
          });
        }
      }

      dirs.push(get_official_minecraft_directory(app));
      self.local_game_directories = dirs;
    }

    for game_dir in &mut self.local_game_directories {
      if game_dir.name == "CURRENT_DIR" {
        game_dir.dir = crate::EXE_DIR.join(".minecraft");
      }
      if (game_dir.name == "CURRENT_DIR" || game_dir.name == "APP_DATA_SUBDIR")
        && !game_dir.dir.exists()
      {
        let _ = fs::create_dir_all(&game_dir.dir);
      }
    }

    // Extract assets if the application is portable
    if *IS_PORTABLE {
      let _ = extract_assets(app);
    }

    self.basic_info = BasicInfo {
      launcher_version: version,
      platform: tauri_plugin_os::platform().to_string(),
      arch: tauri_plugin_os::arch().to_string(),
      os_type: tauri_plugin_os::type_().to_string(),
      platform_version: tauri_plugin_os::version().to_string(),
      is_portable: *IS_PORTABLE,
      // below set to default, will be updated later in first time calling `check_full_login_availability`
      is_china_mainland_ip: false,
      allow_full_login_feature: false,
    };

    Ok(())
  }

  pub fn replace_with_preserved(&mut self, new_config: LauncherConfig, preserved_fields: &[&str]) {
    // Preserve some fields when restore or import
    let mut backup_values = Vec::new();
    for key in preserved_fields {
      if let Ok(value) = self.access(key) {
        backup_values.push((key, value));
      }
    }

    *self = new_config;

    for (key, value) in backup_values {
      let _ = self.update(key, &value);
    }
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

pub fn get_global_game_config(app: &AppHandle) -> GameConfig {
  app
    .state::<Mutex<LauncherConfig>>()
    .lock()
    .unwrap()
    .global_game_config
    .clone()
}
