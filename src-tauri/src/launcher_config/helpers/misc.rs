use crate::launcher_config::commands::retrieve_custom_background_list;
use crate::launcher_config::models::{BasicInfo, GameConfig, GameDirectory, LauncherConfig};
use crate::utils::fs::calculate_sha256;
use crate::utils::portable::extract_assets;
use rand::Rng;
use sjmcl_static::envvar::{APP_DATA_DIR, EXE_PATH, IS_PORTABLE};
use sjmcl_types::error::SJMCLResult;
use sjmcl_types::partial::{PartialAccess, PartialUpdate};
use std::fs;
use std::path::{PathBuf, MAIN_SEPARATOR};
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

pub fn setup_with_app(config: &mut LauncherConfig, app: &AppHandle) -> SJMCLResult<()> {
  // same as lib.rs
  let is_dev = cfg!(debug_assertions);
  let version = match (is_dev, app.package_info().version.to_string().as_str()) {
    (true, _) => "dev".to_string(),
    (false, "0.0.0") => "nightly".to_string(),
    (false, v) => v.to_string(),
  };

  // Set the default download cache directory if unset or not writable, and create it
  if config.download.cache.directory.as_os_str().is_empty()
    || fs::create_dir_all(&config.download.cache.directory).is_err()
  {
    config.download.cache.directory = app
      .path()
      .resolve::<PathBuf>("Download".into(), BaseDirectory::AppCache)?;
    fs::create_dir_all(&config.download.cache.directory)?;
  }

  // Random pick custom background image if enabled
  if config.appearance.background.random_custom {
    let app_handle = app.clone();
    match retrieve_custom_background_list(app_handle) {
      Ok(backgrounds) if !backgrounds.is_empty() => {
        let mut rng = rand::rng();
        let random_index = rng.random_range(0..backgrounds.len());
        config.appearance.background.choice = backgrounds[random_index].clone();
      }
      _ => {
        config.appearance.background.random_custom = false;
      }
    }
  }

  // Set default local game directories
  if config.local_game_directories.is_empty() {
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
          dir: PathBuf::new(),
        });
      } else {
        dirs.push(GameDirectory {
          name: "APP_DATA_SUBDIR".to_string(),
          dir: APP_DATA_DIR.get().unwrap().join(".minecraft"),
        });
      }
    }

    dirs.push(get_official_minecraft_directory(app));
    config.local_game_directories = dirs;
  }

  for game_dir in &mut config.local_game_directories {
    if game_dir.name == "CURRENT_DIR" {
      game_dir.dir = sjmcl_static::envvar::EXE_DIR.join(".minecraft");
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

  config.basic_info = BasicInfo {
    launcher_version: version,
    platform: tauri_plugin_os::platform().to_string(),
    arch: tauri_plugin_os::arch().to_string(),
    os_type: tauri_plugin_os::type_().to_string(),
    platform_version: tauri_plugin_os::version().to_string(),
    exe_sha256: calculate_sha256(&EXE_PATH).unwrap_or_default(),
    is_portable: *IS_PORTABLE,
    is_exe_path_available: check_exe_path_availability(app),
    is_china_mainland_ip: false,
    allow_full_login_feature: false,
  };

  log::info!(
    "Launcher basic info: {}",
    serde_json::to_string(&config.basic_info)
      .unwrap_or_else(|_| format!("{:?}", config.basic_info))
  );

  Ok(())
}

pub fn replace_with_preserved(
  config: &mut LauncherConfig,
  new_config: LauncherConfig,
  preserved_fields: &[&str],
) {
  let mut backup_values = Vec::new();
  for key in preserved_fields {
    if let Ok(value) = config.access(key) {
      backup_values.push((key, value));
    }
  }

  *config = new_config;

  for (key, value) in backup_values {
    let _ = config.update(key, &value);
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

// Check if the executable is running from a temporary or non-persistent path
pub fn check_exe_path_availability(app: &AppHandle) -> bool {
  let exe_str = &*EXE_PATH.to_string_lossy();

  if app
    .path()
    .resolve::<PathBuf>("".into(), BaseDirectory::Temp)
    .is_ok_and(|temp| exe_str.starts_with(&*temp.to_string_lossy()))
  {
    return false;
  }

  // generic keywords and OS-specific hard rules
  // modified from: https://github.com/HMCL-dev/HMCL/blob/0a0476b6d32ccd689c7166d25326c1a81cf64564/HMCL/src/main/java/org/jackhuang/hmcl/Launcher.java#L192
  let exe_lower = exe_str.to_lowercase();
  let keywords = ["temp", "cache", "caches", ".cache"];
  for k in keywords {
    let needle = format!("{sep}{k}{sep}", sep = MAIN_SEPARATOR);
    if exe_lower.contains(&needle) {
      return false;
    }
  }

  #[cfg(target_os = "windows")]
  {
    !(exe_str.contains("\\Temporary Internet Files\\")
      || exe_str.contains("\\INetCache\\")
      || exe_str.contains("\\$Recycle.Bin\\"))
  }

  #[cfg(target_os = "linux")]
  {
    !(exe_str.starts_with("/tmp/")
      || exe_str.starts_with("/var/tmp/")
      || exe_str.starts_with("/var/cache/")
      || exe_str.starts_with("/dev/shm/")
      || exe_str.starts_with("/run/")
      || exe_str.contains("/Trash/"))
  }

  #[cfg(target_os = "macos")]
  {
    !(exe_str.starts_with("/var/folders/")
      || exe_str.starts_with("/private/var/folders/")
      || exe_str.starts_with("/tmp/")
      || exe_str.starts_with("/var/tmp/")
      || exe_str.starts_with("/private/tmp/")
      || exe_str.starts_with("/private/var/tmp/")
      || exe_str.contains("/.Trash/"))
  }
}
