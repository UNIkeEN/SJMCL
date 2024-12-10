mod launcher_config;
mod utils;

use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
use tauri::menu::MenuBuilder;
use tauri::Manager;

pub async fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
      launcher_config::commands::get_launcher_config,
      launcher_config::commands::update_launcher_config,
      launcher_config::commands::get_memory_info,
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
      let mut launcher_config = launcher_config::helpers::read_or_default();
      launcher_config.version = version.clone();
      launcher_config::helpers::save_config(&launcher_config);

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
