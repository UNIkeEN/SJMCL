mod account;
mod error;
mod instance;
mod launcher_config;
mod partial;
mod resource;
mod storage;
mod utils;

use std::fs;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};

use launcher_config::models::LauncherConfig;
use storage::Storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
use tauri::menu::MenuBuilder;
use tauri::path::BaseDirectory;
use tauri::Manager;

static EXE_DIR: LazyLock<PathBuf> = LazyLock::new(|| {
  std::env::current_exe()
    .unwrap()
    .parent()
    .unwrap()
    .to_path_buf()
});

pub async fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      launcher_config::commands::retrive_launcher_config,
      launcher_config::commands::update_launcher_config,
      launcher_config::commands::restore_launcher_config,
      launcher_config::commands::export_launcher_config,
      launcher_config::commands::import_launcher_config,
      launcher_config::commands::retrive_memory_info,
      launcher_config::commands::retrive_custom_background_list,
      launcher_config::commands::add_custom_background,
      launcher_config::commands::delete_custom_background,
      account::commands::retrive_player_list,
      account::commands::add_player,
      account::commands::delete_player,
      account::commands::retrive_selected_player,
      account::commands::update_selected_player,
      account::commands::retrive_auth_server_list,
      account::commands::add_auth_server,
      account::commands::delete_auth_server,
      account::commands::fetch_auth_server_info,
      instance::commands::retrive_game_server_list,
      resource::commands::retrive_game_version_list,
    ])
    .setup(|app| {
      let is_dev = cfg!(debug_assertions);

      // get version and os information
      let version = if is_dev {
        "dev".to_string()
      } else {
        app.package_info().version.to_string()
      };

      let os = tauri_plugin_os::platform().to_string();

      // Set the launcher config
      let mut launcher_config: LauncherConfig = LauncherConfig::load().unwrap_or_default();

      // Set default download cache dir if not exists, create dir
      if launcher_config.download.cache.directory == PathBuf::default() {
        launcher_config.download.cache.directory = app
          .handle()
          .path()
          .resolve::<PathBuf>("Download".into(), BaseDirectory::AppCache)
          .unwrap();
      }

      if !launcher_config.download.cache.directory.exists() {
        fs::create_dir_all(&launcher_config.download.cache.directory).unwrap();
      }

      launcher_config.version = version.clone();
      launcher_config.save().unwrap();

      app.manage(Mutex::new(launcher_config));

      // On platforms other than macOS, set the menu to empty to hide the default menu.
      // On macOS, some shortcuts depend on default menu: https://github.com/tauri-apps/tauri/issues/12458
      if os.clone() != "macos" {
        let menu = MenuBuilder::new(app).build()?;
        app.set_menu(menu)?;
      };

      // send statistics
      tokio::spawn(async move {
        utils::sys_info::send_statistics(version, os).await;
      });

      // Log in debug mode
      if is_dev {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
