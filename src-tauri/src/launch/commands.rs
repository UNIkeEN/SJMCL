use super::{
  helpers::{
    command_generator::generate_launch_command,
    file_validator::{extract_native_libraries, validate_library_files},
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
      client_json::{DownloadsArtifact, McClientInfo},
      misc::{get_instance_game_config, get_instance_subdir_paths},
    },
    models::misc::{Instance, InstanceError, InstanceSubdirType},
  },
  launcher_config::models::{FileValidatePolicy, JavaInfo, LauncherVisiablity},
  storage::load_json_async,
};
use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::sync::{mpsc, Mutex};
use tauri::{AppHandle, Manager, State};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Step 1: select suitable java runtime environment.
#[tauri::command]
pub async fn select_suitable_jre(
  app: AppHandle,
  instance_id: String,
  instances_state: State<'_, Mutex<HashMap<String, Instance>>>,
  javas_state: State<'_, Mutex<Vec<JavaInfo>>>,
  launching_state: State<'_, Mutex<LaunchingState>>,
) -> SJMCLResult<()> {
  {
    let mut launching = launching_state.lock().unwrap();
    launching.current_step = 1;
  }

  let instance = instances_state
    .lock()
    .unwrap()
    .get(&instance_id)
    .ok_or(InstanceError::InstanceNotFoundByID)?
    .clone();
  let game_config = get_instance_game_config(&app, &instance);

  let client_path = instance
    .version_path
    .join(format!("{}.json", instance.name));
  let client_info = load_json_async::<McClientInfo>(&client_path).await?;

  let javas = javas_state.lock().unwrap().clone();
  let selected_java = select_java_runtime(
    &app,
    &game_config.game_java,
    &javas,
    &instance,
    client_info.java_version.major_version,
  )
  .await?;

  let mut launching = launching_state.lock().unwrap();
  launching.game_config = game_config;
  launching.client_info = client_info;
  launching.selected_java = selected_java;
  launching.selected_instance = instance;

  Ok(())
}

// Step 2: extract native libraries, validate game and dependency files.
#[tauri::command]
pub async fn validate_game_files(
  app: AppHandle,
  launching_state: State<'_, Mutex<LaunchingState>>,
) -> SJMCLResult<Vec<DownloadsArtifact>> {
  let (instance, client_info, validate_policy) = {
    let mut launching = launching_state.lock().unwrap();
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

  // extract native libraries
  let dirs = get_instance_subdir_paths(
    &app,
    &instance,
    &[
      &InstanceSubdirType::Libraries,
      &InstanceSubdirType::NativeLibraries,
    ],
  )
  .ok_or(InstanceError::InstanceNotFoundByID)?;
  let [libraries_dir, natives_dir] = dirs.as_slice() else {
    return Err(InstanceError::InstanceNotFoundByID.into());
  };
  extract_native_libraries(&client_info, libraries_dir, natives_dir).await?;

  // validate game files
  let bad_artifacts = match validate_policy {
    FileValidatePolicy::Disable => return Ok(vec![]), // skip
    FileValidatePolicy::Normal => {
      validate_library_files(libraries_dir, &client_info, false).await?
    }
    FileValidatePolicy::Full => validate_library_files(libraries_dir, &client_info, true).await?,
  };
  // TODO: validate not only libraries? also assets?
  Ok(bad_artifacts)
}

// Step 3: validate selected player, if its type is 3rd-party, load server meta for authlib.
// returns Ok(false) if the access_token is expired, Ok(true) if the token is valid.
#[tauri::command]
pub async fn validate_selected_player(
  app: AppHandle,
  launching_state: State<'_, Mutex<LaunchingState>>,
) -> SJMCLResult<bool> {
  let player = get_selected_player_info(&app)?;

  {
    let mut launching = launching_state.lock().unwrap();
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
  launching_state: State<'_, Mutex<LaunchingState>>,
) -> SJMCLResult<()> {
  let (selected_java, game_config, instance_id) = {
    let mut launching = launching_state.lock().unwrap();
    launching.current_step = 4;
    (
      launching.selected_java.clone(),
      launching.game_config.clone(),
      launching.selected_instance.id.clone(),
    )
  };

  // generate and execute launch command
  let cmd_args = generate_launch_command(&app)?;
  let mut cmd_base = Command::new(selected_java.exec_path);
  #[cfg(target_os = "windows")]
  cmd_base.creation_flags(0x08000000);
  let mut child = cmd_base
    .args(cmd_args)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?;
  let pid = child.id();
  {
    let mut launching = launching_state.lock().unwrap();
    launching.pid = pid;
  }

  // wait for the game window, create log window if needed
  let (tx, rx) = mpsc::channel();
  monitor_process(
    app.clone(),
    &mut child,
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

  // clear launching state
  *launching_state.lock().unwrap() = LaunchingState::default();

  Ok(())
}

#[tauri::command]
pub fn cancel_launch_process(launching_state: State<'_, Mutex<LaunchingState>>) -> SJMCLResult<()> {
  let mut launching = launching_state.lock().unwrap();

  // kill process if step 4 has been reached
  if launching.pid != 0 {
    kill_process(launching.pid)?;
  }

  // clear launching state
  *launching = LaunchingState::default();

  Ok(())
}
