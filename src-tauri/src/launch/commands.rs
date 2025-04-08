use super::{
  helpers::{
    cmd_builder::generate_launch_cmd, file_validator::validate_library_files,
    jre_selector::select_java_runtime,
  },
  models::LaunchingState,
};
use crate::{
  account::{
    helpers::{authlib_injector, microsoft},
    models::{AccountError, AccountInfo, PlayerType},
  },
  error::SJMCLResult,
  instance::{
    helpers::{
      client_json::{DownloadsArtifact, McClientInfo},
      misc::{get_instance_game_config, get_instance_subdir_path},
    },
    models::misc::{Instance, InstanceError, InstanceSubdirType},
  },
  launch::helpers::cmd_builder::{execute_cmd, ExecuteType},
  launcher_config::models::JavaInfo,
  storage::load_json_async,
};
use std::sync::Mutex;
use tauri::{AppHandle, State};

// Step 1: select suitable java runtime environment.
#[tauri::command]
pub async fn select_suitable_jre(
  app: AppHandle,
  instance_id: usize,
  instances_state: State<'_, Mutex<Vec<Instance>>>,
  javas_state: State<'_, Mutex<Vec<JavaInfo>>>,
  launching_state: State<'_, Mutex<LaunchingState>>,
) -> SJMCLResult<()> {
  let instance = instances_state
    .lock()
    .unwrap()
    .get(instance_id)
    .ok_or(InstanceError::InstanceNotFoundByID)?
    .clone();
  let game_config = get_instance_game_config(&app, &instance);

  let client_path = instance
    .version_path
    .join(format!("{}.json", instance.name));
  let client_info = load_json_async::<McClientInfo>(&client_path).await?;

  let mut launching = launching_state.lock().unwrap();
  launching.current_step = 1;

  let javas = javas_state.lock().unwrap().clone();
  let selected_java =
    select_java_runtime(&game_config.game_java, &javas, &client_info.java_version)?;

  launching.game_config = game_config;
  launching.client_info = client_info;
  launching.selected_java = selected_java.clone();

  Ok(())
}

// Step 2: validate game and dependency files.
#[tauri::command]
pub async fn validate_game_files(
  app: AppHandle,
  instance_id: usize,
  launching_state: State<'_, Mutex<LaunchingState>>,
) -> SJMCLResult<Vec<DownloadsArtifact>> {
  let client_info = {
    let mut launching = launching_state.lock().unwrap();
    launching.current_step = 2;
    launching.client_info.clone()
  };

  let library_dir = get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::Libraries)
    .ok_or(InstanceError::InstanceNotFoundByID)?;

  let bad_artifacts = validate_library_files(&library_dir, &client_info).await?;
  Ok(bad_artifacts)
}

// Step 3: validate selected player, if its type is 3rd-party, load server meta for authlib.
#[tauri::command]
pub async fn validate_selected_player(
  app: AppHandle,
  player_id: String, // for simplicity, obtain the selected_player id from the frontend here
  account_state: State<'_, Mutex<AccountInfo>>,
  launching_state: State<'_, Mutex<LaunchingState>>,
) -> SJMCLResult<()> {
  let player = {
    let account_info = account_state.lock().unwrap();
    account_info
      .get_player_by_id(player_id.clone())
      .ok_or(AccountError::NotFound)?
      .clone()
  };

  {
    let mut launching = launching_state.lock().unwrap();
    launching.current_step = 3;
    launching.selected_player = Some(player.clone());

    if player.player_type == PlayerType::ThirdParty {
      let meta =
        authlib_injector::info::get_auth_server_info_by_url(&app, player.auth_server_url.clone())?
          .metadata
          .to_string();

      launching.auth_server_meta = Some(meta);
    }
  }

  match player.player_type {
    PlayerType::ThirdParty => {
      authlib_injector::jar::check_authlib_jar(&app).await?;
      authlib_injector::common::validate(&player).await
    }
    PlayerType::Microsoft => microsoft::oauth::validate(&player).await,
    PlayerType::Offline => Ok(()),
  }
}

// Step 4: generate launch command and execute it.
#[tauri::command]
pub async fn launch_game(
  app: AppHandle,
  instance_id: usize,
  launching_state: State<'_, Mutex<LaunchingState>>,
) -> SJMCLResult<()> {
  let client_info = {
    let mut launching = launching_state.lock().unwrap();
    launching.current_step = 4;
    launching.client_info.clone()
  };

  let cmd = generate_launch_cmd(&app, &instance_id, client_info).await?;
  println!("{}", cmd.args.join(" "));

  let output = execute_cmd(cmd, &ExecuteType::NormalExecution).await?;
  println!("{}", String::from_utf8_lossy(&output.stdout));
  println!("{}", String::from_utf8_lossy(&output.stderr));

  // clear launching state
  *launching_state.lock().unwrap() = LaunchingState::default();

  Ok(())
}

#[tauri::command]
pub fn cancel_launch_process(launching_state: State<'_, Mutex<LaunchingState>>) -> SJMCLResult<()> {
  *launching_state.lock().unwrap() = LaunchingState::default();
  // TODO: stop game process if step 4 has started.
  Ok(())
}
