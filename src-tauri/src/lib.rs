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

use account::helpers::authlib_injector::info::refresh_and_update_auth_servers;
use account::helpers::offline::yggdrasil_server::YggdrasilServer;
use account::models::AccountInfo;
use instance::helpers::misc::refresh_and_update_instances;
use instance::helpers::mods::common::LocalModTranslationsCache;
use instance::models::misc::Instance;
use launch::models::LaunchingState;
use launcher_config::helpers::java::refresh_and_update_javas;
use launcher_config::models::{JavaInfo, LauncherConfig};
use resource::helpers::mod_db::{initialize_mod_db, ModDataBase};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex, OnceLock};
use storage::Storage;
use tasks::monitor::TaskMonitor;
use utils::portable::is_portable;
use utils::web::build_sjmcl_client;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
use tauri::path::BaseDirectory;
use tauri::Manager;

static EXE_PATH: LazyLock<PathBuf> = LazyLock::new(|| std::env::current_exe().unwrap());

static EXE_DIR: LazyLock<PathBuf> = LazyLock::new(|| EXE_PATH.parent().unwrap().to_path_buf());

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
      launcher_config::commands::reveal_launcher_config,
      launcher_config::commands::retrieve_custom_background_list,
      launcher_config::commands::add_custom_background,
      launcher_config::commands::delete_custom_background,
      launcher_config::commands::retrieve_java_list,
      launcher_config::commands::validate_java,
      launcher_config::commands::download_mojang_java,
      launcher_config::commands::check_game_directory,
      launcher_config::commands::clear_download_cache,
      launcher_config::commands::check_launcher_update,
      launcher_config::commands::download_launcher_update,
      launcher_config::commands::install_launcher_update,
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
      account::commands::update_player_skin_offline_local,
      account::commands::delete_player,
      account::commands::refresh_player,
      account::commands::retrieve_auth_server_list,
      account::commands::fetch_auth_server,
      account::commands::add_auth_server,
      account::commands::delete_auth_server,
      account::commands::retrieve_other_launcher_account_info,
      account::commands::import_external_account_info,
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
      instance::commands::check_change_mod_loader_availablity,
      instance::commands::change_mod_loader,
      instance::commands::retrieve_modpack_meta_info,
      instance::commands::add_custom_instance_icon,
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
      resource::commands::fetch_optifine_version_list,
      resource::commands::fetch_resource_list_by_name,
      resource::commands::fetch_resource_version_packs,
      resource::commands::download_game_server,
      resource::commands::fetch_remote_resource_by_local,
      resource::commands::update_mods,
      resource::commands::fetch_remote_resource_by_id,
      discover::commands::fetch_news_sources_info,
      discover::commands::fetch_news_post_summaries,
      tasks::commands::schedule_progressive_task_group,
      tasks::commands::cancel_progressive_task,
      tasks::commands::resume_progressive_task,
      tasks::commands::stop_progressive_task,
      tasks::commands::retrieve_progressive_task_list,
      tasks::commands::create_transient_task,
      tasks::commands::get_transient_task,
      tasks::commands::set_transient_task_state,
      tasks::commands::cancel_transient_task,
      tasks::commands::cancel_progressive_task_group,
      tasks::commands::resume_progressive_task_group,
      tasks::commands::stop_progressive_task_group,
      utils::commands::retrieve_memory_info,
      utils::commands::extract_filename,
      utils::commands::delete_file,
      utils::commands::delete_directory,
      utils::commands::retrieve_truetype_font_list,
      utils::commands::check_service_availability,
    ])
    .setup(|app| {
      // init APP_DATA_DIR
      APP_DATA_DIR
        .set(app.path().resolve("", BaseDirectory::AppData).unwrap())
        .expect("APP_DATA_DIR initialization failed");

      // Set up logging
      utils::logging::setup_with_app(app.handle().clone()).unwrap();

      // Set the launcher config and other states
      // Also extract assets in `setup_with_app()` if the application is portable
      let mut launcher_config: LauncherConfig = LauncherConfig::load().unwrap_or_default();
      launcher_config.setup_with_app(app.handle()).unwrap();
      launcher_config.save().unwrap();
      let version = launcher_config.basic_info.launcher_version.clone();
      let os = launcher_config.basic_info.platform.clone();
      let exe_sha256 = launcher_config.basic_info.exe_sha256.clone();
      let auto_purge_launcher_logs = launcher_config.general.advanced.auto_purge_launcher_logs;
      app.manage(Mutex::new(launcher_config));

      let account_info = AccountInfo::load().unwrap_or_default();
      app.manage(Mutex::new(account_info.clone()));

      // Migrate account info to new format
      // TODO: will be removed after the new migration utils crate implemented
      account_info.save().unwrap();

      let instances: HashMap<String, Instance> = HashMap::new();
      app.manage(Mutex::new(instances));

      let javas: Vec<JavaInfo> = vec![];
      app.manage(Mutex::new(javas));

      let mod_database = ModDataBase::new();
      app.manage(Mutex::new(mod_database));

      app.manage(Box::pin(TaskMonitor::new(app.handle().clone())));

      let local_mod_translations = LocalModTranslationsCache::load().unwrap_or_default();
      app.manage(Mutex::new(local_mod_translations));

      let client = build_sjmcl_client(app.handle(), true, false);
      app.manage(client);

      let launching_queue = Vec::<LaunchingState>::new();
      app.manage(Mutex::new(launching_queue));

      // start local yggdrasil server for offline accounts
      let local_ygg_server = YggdrasilServer::new();
      app.manage(Mutex::new(local_ygg_server.clone()));
      tauri::async_runtime::spawn(async move {
        local_ygg_server.run().await.unwrap_or_default();
      });

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

      // Initialize mod database
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        initialize_mod_db(&app_handle).await.unwrap_or_default();
      });

      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        tasks::background::monitor_background_process(app_handle).await;
      });

      // Send statistics
      tokio::spawn(async move {
        utils::sys_info::send_statistics(version, os, exe_sha256).await;
      });

      // Auto purge launcher logs older than 30 days if enabled
      if auto_purge_launcher_logs {
        let app_handle = app.handle().clone();
        tauri::async_runtime::spawn(async move {
          let _ = utils::logging::purge_old_launcher_logs(app_handle, 30).await;
        });
      }

      // On platforms other than macOS, set the menu to empty to hide the default menu.
      // On macOS, some shortcuts depend on default menu: https://github.com/tauri-apps/tauri/issues/12458
      #[cfg(not(target_os = "macos"))]
      {
        use tauri::menu::MenuBuilder;
        let menu = MenuBuilder::new(app).build()?;
        app.set_menu(menu)?;
      }

      // Registering the deep links at runtime on Linux and Windows
      // ref: https://v2.tauri.app/plugin/deep-linking/#registering-desktop-deep-links-at-runtime
      #[cfg(any(target_os = "linux", target_os = "windows"))]
      {
        use tauri_plugin_deep_link::DeepLinkExt;
        app.deep_link().register_all()?;
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
