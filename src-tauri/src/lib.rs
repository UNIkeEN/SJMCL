mod account;
mod error;
mod launcher_config;
mod partial;
mod storage;
mod utils;

use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};

use launcher_config::models::LauncherConfig;
use storage::Storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
use tauri::menu::MenuBuilder;
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
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      launcher_config::commands::get_launcher_config,
      launcher_config::commands::update_launcher_config,
      launcher_config::commands::restore_launcher_config,
      launcher_config::commands::get_memory_info,
      account::commands::get_players,
      account::commands::add_player,
      account::commands::delete_player,
      account::commands::get_auth_servers,
      account::commands::get_auth_server_info,
      account::commands::add_auth_server,
      account::commands::delete_auth_server,
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
      launcher_config.version = version.clone();
      launcher_config.save().unwrap();

      app.manage(Mutex::new(launcher_config));

      // send statistics
      tokio::spawn(async move {
        let _ = utils::send_statistics(version, os).await;
      });

      // Set up menu
      let menu = MenuBuilder::new(app).build()?;
      app.set_menu(menu)?;

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
