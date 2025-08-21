use crate::{
  account::models::{AccountError, AccountInfo, PlayerInfo},
  error::SJMCLResult,
  launcher_config::models::LauncherConfig,
  storage::Storage,
  utils::{
    image::{decode_image, ImageWrapper},
    web::is_china_mainland_ip,
  },
};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

#[derive(serde::Deserialize)]
pub struct OAuthCode {
  pub device_code: String,
  pub user_code: String,
  pub verification_uri: String,
  pub verification_uri_complete: Option<String>,
  pub interval: u64,
}

#[derive(Debug, PartialEq, Eq, Clone, serde::Deserialize, serde::Serialize)]
pub struct OAuthTokens {
  pub access_token: String,
  pub refresh_token: String,
  pub id_token: Option<String>,
}

pub async fn fetch_image(app: &AppHandle, url: String) -> SJMCLResult<ImageWrapper> {
  let client = app.state::<reqwest::Client>();

  let response = client
    .get(url)
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  let img_bytes = response
    .bytes()
    .await
    .map_err(|_| AccountError::ParseError)?
    .to_vec();

  Ok(
    decode_image(img_bytes)
      .map_err(|_| AccountError::ParseError)?
      .into(),
  )
}

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
