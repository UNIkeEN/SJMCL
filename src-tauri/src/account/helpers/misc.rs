use crate::{
  account::models::{AccountError, AccountInfo, PlayerInfo, PlayerType},
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
  match is_china_mainland_ip(app).await {
    Some(is_china_mainland) => {
      if is_china_mainland {
        // in China (mainland), offline login is always available
        let config_binding = app.state::<Mutex<LauncherConfig>>();
        let mut config_state = config_binding.lock()?;
        config_state.basic_info.allow_full_login_feature = true;
        config_state.save()?;
      } else {
        // not in China (mainland), check if any Microsoft account has been added
        let account_binding = app.state::<Mutex<AccountInfo>>();
        let account_state = account_binding.lock().unwrap();

        let config_binding = app.state::<Mutex<LauncherConfig>>();
        let mut config_state = config_binding.lock()?;

        config_state.basic_info.allow_full_login_feature = !account_state
          .players
          .iter()
          .filter(|player| player.player_type == PlayerType::Microsoft)
          .collect::<Vec<&PlayerInfo>>()
          .is_empty();

        config_state.save()?;
      }
    }
    None => {
      // if we cannot determine the IP, check if any account has been added
      let account_binding = app.state::<Mutex<AccountInfo>>();
      let account_state = account_binding.lock()?;

      let config_binding = app.state::<Mutex<LauncherConfig>>();
      let mut config_state = config_binding.lock()?;

      config_state.basic_info.allow_full_login_feature = !account_state.players.is_empty();
      config_state.save()?;
    }
  };
  Ok(())
}
