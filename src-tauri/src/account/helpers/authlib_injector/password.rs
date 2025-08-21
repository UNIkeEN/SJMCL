use crate::{
  account::{
    helpers::authlib_injector::{common::parse_profile, models::MinecraftProfile},
    models::{AccountError, PlayerInfo},
  },
  error::SJMCLResult,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct YggdrasilSession {
  access_token: String,
  selected_profile: Option<YggdrasilProfile>,
  available_profiles: Option<Vec<YggdrasilProfile>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct YggdrasilProfile {
  id: String,
  name: String,
}

async fn get_profile(
  app: &AppHandle,
  auth_server_url: String,
  access_token: String,
  id: String,
  auth_account: String,
  password: String,
) -> SJMCLResult<PlayerInfo> {
  let client = app.state::<reqwest::Client>();
  let profile = client
    .get(format!(
      "{}/sessionserver/session/minecraft/profile/{}",
      auth_server_url, id
    ))
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?
    .json::<MinecraftProfile>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  parse_profile(
    app,
    &profile,
    Some(access_token),
    None,
    Some(auth_server_url),
    Some(auth_account),
    Some(password),
  )
  .await
}

pub async fn login(
  app: &AppHandle,
  auth_server_url: String,
  username: String,
  password: String,
) -> SJMCLResult<Vec<PlayerInfo>> {
  let client = app.state::<reqwest::Client>();

  let response = client
    .post(format!("{}/authserver/authenticate", auth_server_url))
    .json(&json!({
      "username": username,
      "password": password,
      "agent": {
        "name": "Minecraft",
        "version": 1
      },
    }))
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  if !response.status().is_success() {
    return Err(AccountError::Invalid.into());
  }

  let content = response
    .json::<YggdrasilSession>()
    .await
    .map_err(|_| AccountError::ParseError)?;
  let access_token = content.access_token;

  if let Some(selected_profile) = content.selected_profile {
    let id = selected_profile.id;

    Ok(vec![
      get_profile(
        app,
        auth_server_url.clone(),
        access_token.clone(),
        id,
        username.clone(),
        password.clone(),
      )
      .await?,
    ])
  } else {
    let available_profiles = content.available_profiles.unwrap_or_default();

    if available_profiles.is_empty() {
      return Err(AccountError::NotFound.into());
    }

    let mut players = vec![];

    for profile in available_profiles {
      let player = get_profile(
        app,
        auth_server_url.clone(),
        access_token.clone(),
        profile.id,
        username.clone(),
        password.clone(),
      )
      .await?;

      players.push(player);
    }

    Ok(players)
  }
}

pub async fn refresh(
  app: &AppHandle,
  player: &PlayerInfo,
  is_new_bind: bool,
) -> SJMCLResult<PlayerInfo> {
  let client = app.state::<reqwest::Client>();

  let response = client
    .post(format!(
      "{}/authserver/refresh",
      player.auth_server_url.clone().unwrap_or_default()
    ))
    .json(&YggdrasilSession {
      access_token: player.access_token.clone().unwrap_or_default(),
      selected_profile: if is_new_bind {
        Some(YggdrasilProfile {
          id: player.uuid.as_simple().to_string(),
          name: player.name.clone(),
        })
      } else {
        None
      },
      available_profiles: None,
    })
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  if !response.status().is_success() {
    return Err(AccountError::Expired)?;
  }

  let content = response
    .json::<YggdrasilSession>()
    .await
    .map_err(|_| AccountError::ParseError)?;
  get_profile(
    app,
    player.auth_server_url.clone().unwrap_or_default(),
    content.access_token,
    content.selected_profile.ok_or(AccountError::ParseError)?.id,
    player.auth_account.clone().unwrap_or_default(),
    player.password.clone().unwrap_or_default(),
  )
  .await
}
