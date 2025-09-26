use crate::account::constants::DEFAULT_POLLING_INTERVAL;
use crate::account::models::{
  AccountError, AccountInfo, DeviceAuthResponseInfo, OAuthErrorResponse, OAuthTokens, PlayerInfo,
};
use crate::error::SJMCLResult;
use crate::launcher_config::models::LauncherConfig;
use crate::storage::Storage;
use crate::utils::image::{decode_image, ImageWrapper};
use crate::utils::web::is_china_mainland_ip;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest::{self, RequestBuilder};

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

pub async fn oauth_polling(
  app: &AppHandle,
  sender: RequestBuilder,
  auth_info: DeviceAuthResponseInfo,
) -> SJMCLResult<OAuthTokens> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  {
    let mut account_state = account_binding.lock()?;
    account_state.is_oauth_processing = true;
  }
  let mut interval = auth_info.interval.unwrap_or(DEFAULT_POLLING_INTERVAL);
  let start_time = std::time::Instant::now();
  loop {
    {
      let account_state = account_binding.lock()?;
      if !account_state.is_oauth_processing {
        return Err(AccountError::Cancelled)?;
      }
    }

    let response = sender
      .try_clone()
      .ok_or(AccountError::NetworkError)?
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if response.status().is_success() {
      return Ok(
        response
          .json()
          .await
          .map_err(|_| AccountError::ParseError)?,
      );
    } else {
      if response.status().as_u16() != 400 {
        return Err(AccountError::NetworkError)?;
      }

      let error_response: OAuthErrorResponse = response
        .json()
        .await
        .map_err(|_| AccountError::ParseError)?;

      match error_response.error.as_str() {
        "authorization_pending" => {
          // continue polling
        }
        "slow_down" => {
          interval += 5;
        }
        "access_denied" => {
          return Err(AccountError::Cancelled)?;
        }
        "expired_token" => {
          return Err(AccountError::Expired)?;
        }
        _ => {
          return Err(AccountError::NetworkError)?;
        }
      }
    }

    if start_time.elapsed().as_secs() >= auth_info.expires_in {
      return Err(AccountError::Expired)?;
    }

    tokio::time::sleep(std::time::Duration::from_secs(interval)).await;
  }
}
