use super::{
  helpers::{
    command_generator::{export_full_launch_command, generate_launch_command},
    file_validator::{extract_native_libraries, get_invalid_library_files},
    jre_selector::select_java_runtime,
    process_monitor::{kill_process, monitor_process, set_process_priority},
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
      client_json::{replace_native_libraries, McClientInfo},
      misc::{get_instance_game_config, get_instance_subdir_paths},
    },
    models::misc::{Instance, InstanceError, InstanceSubdirType, ModLoaderStatus},
  },
  launch::{
    helpers::{
      command_generator::LaunchCommand, file_validator::get_invalid_assets, misc::get_separator,
    },
    models::LaunchError,
  },
  launcher_config::{
    helpers::java::refresh_and_update_javas,
    models::{FileValidatePolicy, JavaInfo, LauncherConfig, LauncherVisiablity},
  },
  resource::helpers::misc::get_source_priority_list,
  storage::load_json_async,
  tasks::commands::schedule_progressive_task_group,
  utils::{fs::create_zip_from_dirs, window::create_webview_window},
};
use std::{collections::HashMap, path::PathBuf};
use std::{
  fs,
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

  refresh_and_update_javas(&app).await;
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
  let (instance, mut client_info, validate_policy) = {
    let mut launching_queue = launching_queue_state.lock()?;
    let launching = launching_queue
      .last_mut()
      .ok_or(LaunchError::LaunchingStateNotFound)?;
    launching.current_step = 2;
    (
      launching.selected_instance.clone(),
      launching.client_info.clone(),
      launching
        .game_config
        .advanced
        .workaround
        .game_file_validate_policy
        .clone(),
    )
  };

  if instance.mod_loader.status != ModLoaderStatus::Installed {
    return Err(LaunchError::ModLoaderNotInstalled.into());
  }

  replace_native_libraries(&app, &mut client_info, &instance)
    .await
    .map_err(|_| InstanceError::ClientJsonParseError)?;

  {
    let mut launching_queue = launching_queue_state.lock()?;
    let launching = launching_queue
      .last_mut()
      .ok_or(LaunchError::LaunchingStateNotFound)?;

    launching.client_info = client_info.clone();
  }

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
      get_invalid_assets(&app, &client_info, priority_list[0], assets_dir, false).await?,
    ]
    .concat(),
    FileValidatePolicy::Full => [
      get_invalid_library_files(priority_list[0], libraries_dir, &client_info, true).await?,
      get_invalid_assets(&app, &client_info, priority_list[0], assets_dir, true).await?,
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
      let meta = authlib_injector::info::get_auth_server_info_by_url(
        &app,
        player.auth_server_url.clone().unwrap_or_default(),
      )?
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
  quick_play_singleplayer: Option<String>,
  quick_play_multiplayer: Option<String>,
) -> SJMCLResult<()> {
  let (id, selected_java, game_config, instance) = {
    let mut launching_queue = launching_queue_state.lock()?;
    let launching = launching_queue
      .last_mut()
      .ok_or(LaunchError::LaunchingStateNotFound)?;
    launching.current_step = 4;
    (
      launching.id,
      launching.selected_java.clone(),
      launching.game_config.clone(),
      launching.selected_instance.clone(),
    )
  };

  let instance_id = instance.id.clone();
  let work_dir = get_instance_subdir_paths(&app, &instance, &[&InstanceSubdirType::Root])
    .ok_or(InstanceError::InstanceNotFoundByID)?
    .first()
    .ok_or(InstanceError::InstanceNotFoundByID)?
    .clone();

  // generate launch command
  let LaunchCommand {
    class_paths,
    args: cmd_args,
  } = generate_launch_command(&app, quick_play_singleplayer, quick_play_multiplayer).await?;
  let mut cmd_base = Command::new(selected_java.exec_path.clone());

  let full_cmd = export_full_launch_command(&class_paths, &cmd_args, &selected_java.exec_path);
  println!("[Launch Command] {}", full_cmd);

  // execute launch command
  #[cfg(target_os = "windows")]
  cmd_base.creation_flags(0x08000000);

  let child = cmd_base
    .current_dir(&work_dir)
    .env("CLASSPATH", class_paths.join(get_separator()))
    .args(cmd_args)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?;

  let pid = child.id();
  {
    let mut launching_queue = launching_queue_state.lock()?;
    let launching = launching_queue
      .last_mut()
      .ok_or(LaunchError::LaunchingStateNotFound)?;
    launching.pid = pid;
    launching.full_command = full_cmd;
  }

  // wait for the game window, create log window if needed
  let (tx, rx) = mpsc::channel();
  monitor_process(
    app.clone(),
    id,
    child,
    instance_id,
    game_config.display_game_log,
    &game_config.game_window.custom_title,
    game_config.launcher_visibility.clone(),
    tx,
  )
  .await?;
  let _ = rx.recv();

  // set process priority and window title (if error, keep slient)
  let _ = set_process_priority(pid, &game_config.performance.process_priority);

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
  let mut launching_queue = launching_queue_state.lock()?;

  // kill process if pid exists
  if let Some(launching) = launching_queue.last_mut() {
    if launching.pid != 0 {
      launching.current_step = 0; // mark as manually cancelled to avoid game error window popping up
      kill_process(launching.pid)?;
    }
  }

  Ok(())
}

#[tauri::command]
pub async fn open_game_log_window(app: AppHandle, launching_id: u64) -> SJMCLResult<()> {
  create_webview_window(&app, &format!("game_log_{launching_id}"), "game_log", None).await?;

  Ok(())
}

#[tauri::command]
pub fn retrieve_game_log(app: AppHandle, launching_id: u64) -> SJMCLResult<Vec<String>> {
  let log_file_dir = app.path().resolve::<PathBuf>(
    format!("GameLogs/game_log_{launching_id}.log").into(),
    BaseDirectory::AppCache,
  )?;
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
  launching_id: u64,
) -> SJMCLResult<LaunchingState> {
  let launching_queue = launching_queue_state.lock()?;
  if let Some(launching) = launching_queue.iter().find(|l| l.id == launching_id) {
    Ok(launching.clone())
  } else {
    Err(LaunchError::LaunchingStateNotFound.into())
  }
}

#[tauri::command]
pub fn export_game_crash_info(
  app: AppHandle,
  launching_queue_state: State<'_, Mutex<Vec<LaunchingState>>>,
  launching_id: u64,
  save_path: String,
) -> SJMCLResult<String> {
  // game log
  let game_log_path = app.path().resolve::<PathBuf>(
    format!("GameLogs/game_log_{launching_id}.log").into(),
    BaseDirectory::AppCache,
  )?;

  let launching_queue = launching_queue_state.lock()?;
  let launching = launching_queue
    .iter()
    .find(|l| l.id == launching_id)
    .ok_or(LaunchError::LaunchingStateNotFound)?;
  // version json and sjmcl instance config
  let version_info_path = launching
    .selected_instance
    .version_path
    .join(format!("{}.json", launching.selected_instance.name));
  let version_config_path = launching.selected_instance.get_json_cfg_path();

  // full launch script
  let launch_script_path = app.path().resolve::<PathBuf>(
    if cfg!(target_os = "windows") {
      "launch.bat".into()
    } else {
      "launch.sh".into()
    },
    BaseDirectory::Temp,
  )?;
  fs::write(&launch_script_path, &launching.full_command)?;

  let zip_file_path = PathBuf::from(save_path);
  create_zip_from_dirs(
    vec![
      game_log_path,
      version_info_path,
      version_config_path,
      launch_script_path,
    ],
    zip_file_path.clone(),
  )
}
