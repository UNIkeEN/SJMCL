mod account;
mod discover;
mod error;
mod instance;
mod launch;
mod launcher_config;
mod partial;
mod resource;
mod storage;
mod tasks;
mod utils;

use account::models::AccountInfo;
use instance::helpers::misc::refresh_and_update_instances;
use instance::models::misc::Instance;
use launcher_config::{
  helpers::refresh_and_update_javas,
  models::{JavaInfo, LauncherConfig},
};
use std::path::PathBuf;
use std::sync::{Arc, LazyLock, Mutex};
use storage::Storage;
use tasks::monitor::TaskMonitor;
use tokio::sync::Notify;

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
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      launcher_config::commands::retrieve_launcher_config,
      launcher_config::commands::update_launcher_config,
      launcher_config::commands::restore_launcher_config,
      launcher_config::commands::export_launcher_config,
      launcher_config::commands::import_launcher_config,
      launcher_config::commands::retrieve_memory_info,
      launcher_config::commands::retrieve_custom_background_list,
      launcher_config::commands::add_custom_background,
      launcher_config::commands::delete_custom_background,
      launcher_config::commands::retrieve_java_list,
      launcher_config::commands::check_game_directory,
      account::commands::retrieve_player_list,
      account::commands::add_player_offline,
      account::commands::fetch_oauth_code,
      account::commands::add_player_oauth,
      account::commands::add_player_3rdparty_password,
      account::commands::add_player_from_selection,
      account::commands::update_player_skin_offline_preset,
      account::commands::delete_player,
      account::commands::refresh_player,
      account::commands::validate_player,
      account::commands::retrieve_auth_server_list,
      account::commands::add_auth_server,
      account::commands::delete_auth_server,
      account::commands::fetch_auth_server_info,
      instance::commands::retrieve_instance_list,
      instance::commands::update_instance_config,
      instance::commands::retrieve_instance_game_config,
      instance::commands::reset_instance_game_config,
      instance::commands::open_instance_subdir,
      instance::commands::delete_instance,
      instance::commands::rename_instance,
      instance::commands::copy_resource_to_instances,
      instance::commands::move_resource_to_instance,
      instance::commands::retrieve_world_list,
      instance::commands::retrieve_world_details,
      instance::commands::retrieve_game_server_list,
      instance::commands::retrieve_local_mod_list,
      instance::commands::retrieve_resource_pack_list,
      instance::commands::retrieve_server_resource_pack_list,
      instance::commands::retrieve_schematic_list,
      instance::commands::retrieve_shader_pack_list,
      instance::commands::retrieve_screenshot_list,
      instance::commands::toggle_mod_by_extension,
      launch::commands::validate_game_files,
      launch::commands::launch_game,
      resource::commands::fetch_game_version_list,
      resource::commands::fetch_mod_loader_version_list,
      discover::commands::fetch_post_sources_info,
      tasks::commands::schedule_task_group,
      tasks::commands::cancel_task,
      tasks::commands::resume_task,
      tasks::commands::stop_task,
      tasks::commands::retrieve_task_list,
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
      launcher_config.setup_with_app(app.handle()).unwrap();
      launcher_config.save().unwrap();

      app.manage(Mutex::new(launcher_config));
      let instances: Vec<Instance> = vec![];
      app.manage(Mutex::new(instances));

      let account_info: AccountInfo = AccountInfo::load().unwrap_or_default();
      app.manage(Mutex::new(account_info));
      let notify = Arc::new(Notify::new());
      app.manage(Box::pin(TaskMonitor::new(app.handle().clone(), notify)));

      // Refresh all instances
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        refresh_and_update_instances(&app_handle).await;
      });

      let javas: Vec<JavaInfo> = vec![];
      app.manage(Mutex::new(javas));

      // Refresh all javas
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        refresh_and_update_javas(&app_handle).await;
      });

      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        tasks::background::monitor_background_process(app_handle).await;
      });

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
