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

use account::{
  helpers::authlib_injector::info::refresh_and_update_auth_servers, models::AccountInfo,
};

use async_speed_limit::Limiter;
use instance::helpers::misc::refresh_and_update_instances;
use instance::models::misc::Instance;
use launch::models::LaunchingState;
use launcher_config::{
  helpers::java::refresh_and_update_javas,
  models::{JavaInfo, LauncherConfig},
};
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};
use std::{collections::HashMap, sync::OnceLock};
use storage::Storage;
use tasks::monitor::TaskMonitor;
use tauri_plugin_log::{Target, TargetKind};
use utils::{portable::is_portable, web::build_sjmcl_client};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
use tauri::menu::MenuBuilder;
use tauri::{path::BaseDirectory, Manager};

static EXE_DIR: LazyLock<PathBuf> = LazyLock::new(|| {
  std::env::current_exe()
    .unwrap()
    .parent()
    .unwrap()
    .to_path_buf()
});

static IS_PORTABLE: LazyLock<bool> = LazyLock::new(|| is_portable().unwrap_or(false));

static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

pub async fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      let main_window = app.get_webview_window("main").expect("no main window");

      let _ = main_window.show(); // may hide by launcher_visibility settings
                                  // FIXME: this show() seems no use in macOS build mode (ref: https://github.com/tauri-apps/tauri/issues/13400#issuecomment-2866462355).
      let _ = main_window.set_focus();
    }))
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      launcher_config::commands::retrieve_launcher_config,
      launcher_config::commands::update_launcher_config,
      launcher_config::commands::restore_launcher_config,
      launcher_config::commands::export_launcher_config,
      launcher_config::commands::import_launcher_config,
      launcher_config::commands::retrieve_custom_background_list,
      launcher_config::commands::add_custom_background,
      launcher_config::commands::delete_custom_background,
      launcher_config::commands::retrieve_java_list,
      launcher_config::commands::validate_java,
      launcher_config::commands::check_game_directory,
      launcher_config::commands::clear_download_cache,
      account::commands::retrieve_player_list,
      account::commands::add_player_offline,
      account::commands::fetch_oauth_code,
      account::commands::add_player_oauth,
      account::commands::relogin_player_oauth,
      account::commands::cancel_oauth,
      account::commands::add_player_3rdparty_password,
      account::commands::relogin_player_3rdparty_password,
      account::commands::add_player_from_selection,
      account::commands::update_player_skin_offline_preset,
      account::commands::delete_player,
      account::commands::refresh_player,
      account::commands::retrieve_auth_server_list,
      account::commands::add_auth_server,
      account::commands::delete_auth_server,
      account::commands::fetch_auth_server,
      instance::commands::retrieve_instance_list,
      instance::commands::create_instance,
      instance::commands::update_instance_config,
      instance::commands::retrieve_instance_game_config,
      instance::commands::reset_instance_game_config,
      instance::commands::retrieve_instance_subdir_path,
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
      instance::commands::create_launch_desktop_shortcut,
      instance::commands::finish_mod_loader_install,
      instance::commands::retrieve_modpack_meta_info,
      launch::commands::select_suitable_jre,
      launch::commands::validate_game_files,
      launch::commands::validate_selected_player,
      launch::commands::launch_game,
      launch::commands::cancel_launch_process,
      launch::commands::open_game_log_window,
      launch::commands::retrieve_game_log,
      launch::commands::retrieve_game_launching_state,
      launch::commands::export_game_crash_info,
      resource::commands::fetch_game_version_list,
      resource::commands::fetch_game_version_specific,
      resource::commands::fetch_mod_loader_version_list,
      resource::commands::fetch_resource_list_by_name,
      resource::commands::fetch_resource_version_packs,
      resource::commands::download_game_server,
      resource::commands::fetch_remote_resource_by_local,
      resource::commands::update_mods,
      resource::commands::fetch_remote_resource_by_id,
      discover::commands::fetch_news_sources_info,
      discover::commands::fetch_news_post_summaries,
      tasks::commands::schedule_progressive_task_group,
      tasks::commands::retrieve_progressive_task_list,
      tasks::commands::cancel_progressive_task_group,
      tasks::commands::resume_progressive_task_group,
      tasks::commands::stop_progressive_task_group,
      tasks::commands::retry_progressive_task_group,
      utils::commands::retrieve_memory_info,
      utils::commands::extract_filename,
      utils::commands::retrieve_truetype_font_list,
      utils::commands::check_service_availability,
    ])
    .setup(|app| {
      let is_dev = cfg!(debug_assertions);

      // Get version and os information
      let version = match (is_dev, app.package_info().version.to_string().as_str()) {
        (true, _) => "dev".to_string(),
        (false, "0.0.0") => "nightly".to_string(),
        (false, v) => v.to_string(),
      };
      let os = tauri_plugin_os::platform().to_string();

      // init APP_DATA_DIR
      APP_DATA_DIR
        .set(app.path().resolve("", BaseDirectory::AppData).unwrap())
        .expect("APP_DATA_DIR initialization failed");

      // Set the launcher config and other states
      // Also extract assets in `setup_with_app()` if the application is portable
      let mut launcher_config: LauncherConfig = LauncherConfig::load().unwrap_or_default();
      launcher_config.setup_with_app(app.handle()).unwrap();
      launcher_config.save().unwrap();

      let limiter = if launcher_config.download.transmission.enable_speed_limit {
        Some(<Limiter>::new(
          (launcher_config.download.transmission.speed_limit_value * 1024) as f64,
        ))
      } else {
        None
      };
      app.manage(limiter);
      app.manage(Mutex::new(launcher_config));

      let account_info = AccountInfo::load().unwrap_or_default();
      app.manage(Mutex::new(account_info));

      let instances: HashMap<String, Instance> = HashMap::new();
      app.manage(Mutex::new(instances));

      let javas: Vec<JavaInfo> = vec![];
      app.manage(Mutex::new(javas));

      app.manage(Box::pin(TaskMonitor::new(app.handle().clone())));

      let client = build_sjmcl_client(app.handle(), true, false);
      app.manage(client);

      let launching_queue = Vec::<LaunchingState>::new();
      app.manage(Mutex::new(launching_queue));

      // check if full account feature (offline and 3rd-party login) is available
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        account::helpers::misc::check_full_login_availability(&app_handle)
          .await
          .unwrap_or_default();
      });

      // Refresh all auth servers
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        refresh_and_update_auth_servers(&app_handle)
          .await
          .unwrap_or_default();
      });

      // Refresh all instances
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        refresh_and_update_instances(&app_handle, true).await;
      });

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

      // Send statistics
      tokio::spawn(async move {
        utils::sys_info::send_statistics(version, os).await;
      });

      // Registering the deep links at runtime on Linux and Windows
      // ref: https://v2.tauri.app/plugin/deep-linking/#registering-desktop-deep-links-at-runtime
      #[cfg(any(target_os = "linux", target_os = "windows"))]
      {
        use tauri_plugin_deep_link::DeepLinkExt;
        app.deep_link().register_all()?;
      }

      // Log in debug mode
      if is_dev {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .targets([
              Target::new(TargetKind::Stdout),
              Target::new(TargetKind::Webview),
            ])
            .build(),
        )?;
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
