use crate::{
  account::models::{AccountError, AccountInfo, PlayerInfo},
  error::SJMCLResult,
  launcher_config::models::LauncherConfig,
  storage::Storage,
  utils::web::is_china_mainland_ip,
};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub fn get_selected_player_info(app: &AppHandle) -> SJMCLResult<PlayerInfo> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  let account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let config_state = config_binding.lock()?;

  let selected_player_id = &config_state.states.shared.selected_player_id;
  if selected_player_id.is_empty() {
    return Err(AccountError::NotFound.into());
  }

  let player_info = account_state
    .players
    .iter()
    .find(|player| player.id == *selected_player_id)
    .ok_or(AccountError::NotFound)?;

  Ok(player_info.clone())
}

pub async fn check_full_login_availability(app: &AppHandle) -> SJMCLResult<()> {
  let loc_flag = is_china_mainland_ip(app).await;

  let account_binding = app.state::<Mutex<AccountInfo>>();
  let account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;

  match loc_flag {
    Some(true) => {
      // in China (mainland), full account feature (offline and 3rd-party login) is always available
      config_state.partial_update(
        app,
        "basic_info.allow_full_login_feature",
        &serde_json::to_string(&true)?,
      )?;
    }
    _ => {
      // not in China (mainland) or cannot determine the IP
      // check if any player has been added (not only microsoft type player, because user may delete it)
      config_state.partial_update(
        app,
        "basic_info.allow_full_login_feature",
        &serde_json::to_string(&!account_state.players.is_empty())?,
      )?;
    }
  }

  config_state.save()?;
  Ok(())
}
