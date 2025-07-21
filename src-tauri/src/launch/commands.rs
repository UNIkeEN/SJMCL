use super::{
  helpers::{
    command_generator::generate_launch_command,
    file_validator::{extract_native_libraries, get_invalid_library_files},
    jre_selector::select_java_runtime,
    process_monitor::{
      change_process_window_title, kill_process, monitor_process, set_process_priority,
    },
  },
  models::LaunchingState,
};
use crate::{
  account::{
    helpers::{authlib_injector, microsoft, misc::get_selected_player_info},
    models::PlayerType,
  },
  error::SJMCLResult,
  instance::{
    helpers::{
      client_json::McClientInfo,
      misc::{get_instance_game_config, get_instance_subdir_paths},
    },
    models::misc::{AssetIndex, Instance, InstanceError, InstanceSubdirType},
  },
  launch::{helpers::file_validator::get_invalid_assets, models::LaunchError},
  launcher_config::models::{FileValidatePolicy, JavaInfo, LauncherConfig, LauncherVisiablity},
  resource::helpers::misc::get_source_priority_list,
  storage::load_json_async,
  tasks::commands::schedule_progressive_task_group,
  utils::{fs::create_zip_from_dirs, window::create_webview_window},
};
use chrono::Local;
use std::{collections::HashMap, path::PathBuf};
use std::{
  io::{prelude::*, BufReader},
  process::{Command, Stdio},
};
use std::{
  sync::{mpsc, Mutex},
  time::{SystemTime, UNIX_EPOCH},
};
use tauri::{path::BaseDirectory, AppHandle, Manager, State};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Step 1: select suitable java runtime environment.
#[tauri::command]
pub async fn select_suitable_jre(
  app: AppHandle,
  instance_id: String,
  instances_state: State<'_, Mutex<HashMap<String, Instance>>>,
  javas_state: State<'_, Mutex<Vec<JavaInfo>>>,
  launching_queue_state: State<'_, Mutex<Vec<LaunchingState>>>,
) -> SJMCLResult<()> {
  let instance = instances_state
    .lock()?
    .get(&instance_id)
    .ok_or(InstanceError::InstanceNotFoundByID)?
    .clone();
  let game_config = get_instance_game_config(&app, &instance);

  let client_path = instance
    .version_path
    .join(format!("{}.json", instance.name));
  let client_info = load_json_async::<McClientInfo>(&client_path).await?;

  let asset_index_path = get_instance_subdir_paths(&app, &instance, &[&InstanceSubdirType::Assets])
    .ok_or(InstanceError::InstanceNotFoundByID)?[0]
    .join(format!("indexes/{}.json", client_info.asset_index.id));
  let asset_index = load_json_async::<AssetIndex>(&asset_index_path).await?;

  let javas = javas_state.lock()?.clone();
  let selected_java = select_java_runtime(
    &app,
    &game_config.game_java,
    &javas,
    &instance,
    client_info.java_version.major_version,
  )
  .await?;

  let timestamp = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
  let mut launching = launching_queue_state.lock()?;
  launching.push(LaunchingState {
    id: timestamp,
    game_config,
    client_info,
    asset_index,
    selected_java,
    selected_instance: instance,
    ..LaunchingState::default()
  });

  Ok(())
}

// Step 2: extract native libraries, validate game and dependency files.
#[tauri::command]
pub async fn validate_game_files(
  app: AppHandle,
  launcher_config_state: State<'_, Mutex<LauncherConfig>>,
  launching_queue_state: State<'_, Mutex<Vec<LaunchingState>>>,
) -> SJMCLResult<()> {
  let (instance, client_info, asset_index, validate_policy) = {
    let mut launching_queue = launching_queue_state.lock()?;
    let launching = launching_queue
      .last_mut()
      .ok_or(LaunchError::LaunchingStateNotFound)?;
    launching.current_step = 2;
    (
      launching.selected_instance.clone(),
      launching.client_info.clone(),
      launching.asset_index.clone(),
      launching
        .game_config
        .advanced
        .workaround
        .game_file_validate_policy
        .clone(),
    )
  };

  // extract native libraries
  let dirs = get_instance_subdir_paths(
    &app,
    &instance,
    &[
      &InstanceSubdirType::Libraries,
      &InstanceSubdirType::NativeLibraries,
      &InstanceSubdirType::Assets,
    ],
  )
  .ok_or(InstanceError::InstanceNotFoundByID)?;
  let [libraries_dir, natives_dir, assets_dir] = dirs.as_slice() else {
    return Err(InstanceError::InstanceNotFoundByID.into());
  };
  extract_native_libraries(&client_info, libraries_dir, natives_dir).await?;

  let priority_list = {
    let launcher_config = launcher_config_state.lock()?;
    get_source_priority_list(&launcher_config)
  };

  // validate game files
  let incomplete_files = match validate_policy {
    FileValidatePolicy::Disable => return Ok(()), // skip
    FileValidatePolicy::Normal => [
      get_invalid_library_files(priority_list[0], libraries_dir, &client_info, false).await?,
      get_invalid_assets(priority_list[0], assets_dir, &asset_index, false).await?,
    ]
    .concat(),
    FileValidatePolicy::Full => [
      get_invalid_library_files(priority_list[0], libraries_dir, &client_info, true).await?,
      get_invalid_assets(priority_list[0], assets_dir, &asset_index, true).await?,
    ]
    .concat(),
  };
  if incomplete_files.is_empty() {
    Ok(())
  } else {
    schedule_progressive_task_group(
      app,
      format!("patch-files?{}", client_info.id),
      incomplete_files,
      true,
    )
    .await?;
    Err(LaunchError::GameFilesIncomplete.into())
  }
}

// Step 3: validate selected player, if its type is 3rd-party, load server meta for authlib.
// returns Ok(false) if the access_token is expired, Ok(true) if the token is valid.
#[tauri::command]
pub async fn validate_selected_player(
  app: AppHandle,
  launching_queue_state: State<'_, Mutex<Vec<LaunchingState>>>,
) -> SJMCLResult<bool> {
  let player = get_selected_player_info(&app)?;

  {
    let mut launching_queue = launching_queue_state.lock()?;
    let launching = launching_queue
      .last_mut()
      .ok_or(LaunchError::LaunchingStateNotFound)?;
    launching.current_step = 3;
    launching.selected_player = Some(player.clone());

    if player.player_type == PlayerType::ThirdParty {
      let meta =
        authlib_injector::info::get_auth_server_info_by_url(&app, player.auth_server_url.clone())?
          .metadata
          .to_string();

      launching.auth_server_meta = meta;
    }
  }

  match player.player_type {
    PlayerType::ThirdParty => {
      authlib_injector::jar::check_authlib_jar(&app).await?;
      authlib_injector::common::validate(&app, &player).await
    }
    PlayerType::Microsoft => microsoft::oauth::validate(&app, &player).await,
    PlayerType::Offline => Ok(true),
  }
}

#[tauri::command]
pub async fn launch_game(
  app: AppHandle,
  launching_queue_state: State<'_, Mutex<Vec<LaunchingState>>>,
) -> SJMCLResult<()> {
  let (id, selected_java, game_config, instance_id) = {
    let mut launching_queue = launching_queue_state.lock()?;
    let launching = launching_queue
      .last_mut()
      .ok_or(LaunchError::LaunchingStateNotFound)?;
    launching.current_step = 4;
    (
      launching.id,
      launching.selected_java.clone(),
      launching.game_config.clone(),
      launching.selected_instance.id.clone(),
    )
  };

  // generate launch command
  let cmd_args = generate_launch_command(&app)?;
  let mut cmd_base = Command::new(selected_java.exec_path.clone());

  // let full_cmd = std::iter::once(selected_java.exec_path.clone())
  // .chain(cmd_args.iter().cloned())
  // .collect::<Vec<_>>()
  // .join(" ");
  // println!("[Launch Command] {}", full_cmd);

  // execute launch command
  #[cfg(target_os = "windows")]
  cmd_base.creation_flags(0x08000000);

  let child = cmd_base
    .args(cmd_args)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?;

  let pid = child.id();
  {
    let mut launching_queue = launching_queue_state.lock()?;
    launching_queue
      .last_mut()
      .ok_or(LaunchError::LaunchingStateNotFound)?
      .pid = pid;
  }

  // wait for the game window, create log window if needed
  let (tx, rx) = mpsc::channel();
  monitor_process(
    app.clone(),
    id,
    child,
    instance_id,
    game_config.display_game_log,
    game_config.launcher_visibility.clone(),
    tx,
  )
  .await?;
  let _ = rx.recv();

  // set process priority and window title (if error, keep slient)
  let _ = set_process_priority(pid, &game_config.performance.process_priority);
  let _ = !game_config.game_window.custom_title.trim().is_empty()
    && change_process_window_title(pid, &game_config.game_window.custom_title).is_err();

  if game_config.launcher_visibility != LauncherVisiablity::Always {
    let _ = app
      .get_webview_window("main")
      .expect("no main window")
      .hide();
  }

  Ok(())
}

#[tauri::command]
pub fn cancel_launch_process(
  launching_queue_state: State<'_, Mutex<Vec<LaunchingState>>>,
) -> SJMCLResult<()> {
  let launching_queue = launching_queue_state.lock()?;

  // kill process if pid exists
  if let Some(launching) = launching_queue.last() {
    if launching.pid != 0 {
      kill_process(launching.pid)?;
    }
  }

  Ok(())
}

#[tauri::command]
pub async fn open_game_log_window(app: AppHandle, log_label: String) -> SJMCLResult<()> {
  create_webview_window(&app, &log_label, "game_log", None).await?;

  Ok(())
}

#[tauri::command]
pub fn retrieve_game_log(app: AppHandle, id: u64) -> SJMCLResult<Vec<String>> {
  let log_file_dir = app
    .path()
    .resolve::<PathBuf>(format!("game_log_{id}.log").into(), BaseDirectory::AppCache)?;
  Ok(
    BufReader::new(std::fs::OpenOptions::new().read(true).open(log_file_dir)?)
      .lines()
      .map_while(Result::ok)
      .collect(),
  )
}

#[tauri::command]
pub fn retrieve_game_launching_state(
  launching_queue_state: State<'_, Mutex<Vec<LaunchingState>>>,
  id: u64,
) -> SJMCLResult<LaunchingState> {
  let launching_queue = launching_queue_state.lock()?;
  if let Some(launching) = launching_queue.iter().find(|l| l.id == id) {
    Ok(launching.clone())
  } else {
    Err(LaunchError::LaunchingStateNotFound.into())
  }
}

#[tauri::command]
pub fn export_game_crash_info(
  app: AppHandle,
  launching_queue_state: State<'_, Mutex<Vec<LaunchingState>>>,
  id: u64,
) -> SJMCLResult<String> {
  let log_file_dir = app
    .path()
    .resolve::<PathBuf>(format!("game_log_{id}.log").into(), BaseDirectory::AppCache)?;
  let launching_queue = launching_queue_state.lock()?;
  let launching = launching_queue
    .iter()
    .find(|l| l.id == id)
    .ok_or(LaunchError::LaunchingStateNotFound)?;
  let version_info_dir = launching
    .selected_instance
    .version_path
    .join(format!("{}.json", launching.selected_instance.name));

  let time = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let zip_file_path = app.path().resolve::<PathBuf>(
    format!("minecraft-exported-crash-info-{time}.zip").into(),
    BaseDirectory::AppCache,
  )?;

  create_zip_from_dirs(vec![log_file_dir, version_info_dir], zip_file_path.clone())
}
