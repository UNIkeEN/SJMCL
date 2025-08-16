use crate::{
  account::{
    helpers::authlib_injector::{common::parse_profile, models::MinecraftProfile},
    models::{AccountError, PlayerInfo},
  },
  error::SJMCLResult,
};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

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
    .header("Content-Type", "application/json")
    .body(
      json!({
        "username": username,
        "password": password,
        "agent": {
          "name": "Minecraft",
          "version": 1
        },
      })
      .to_string(),
    )
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  if !response.status().is_success() {
    return Err(AccountError::Invalid.into());
  }

  let content = response
    .json::<Value>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  let access_token = content["accessToken"]
    .as_str()
    .unwrap_or_default()
    .to_string();

  if let Some(selected_profile) = content["selectedProfile"].as_object() {
    let id = selected_profile["id"]
      .as_str()
      .ok_or(AccountError::ParseError)?
      .to_string();

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
    let available_profiles = content["availableProfiles"]
      .as_array()
      .ok_or(AccountError::ParseError)?;

    if available_profiles.is_empty() {
      return Err(AccountError::NotFound.into());
    }

    let mut players = vec![];

    for profile in available_profiles {
      let id = profile["id"]
        .as_str()
        .ok_or(AccountError::ParseError)?
        .to_string();

      let player = get_profile(
        app,
        auth_server_url.clone(),
        access_token.clone(),
        id,
        username.clone(),
        password.clone(),
      )
      .await?;

      players.push(player);
    }

    Ok(players)
  }
}

pub async fn refresh(app: &AppHandle, player: &PlayerInfo) -> SJMCLResult<PlayerInfo> {
  let client = app.state::<reqwest::Client>();

  let response = client
    .post(format!(
      "{}/authserver/refresh",
      player.auth_server_url.clone().unwrap_or_default()
    ))
    .header("Content-Type", "application/json")
    .body(
      json!({
        "accessToken": player.access_token,
        "selectedProfile": {
          "id": player.uuid.as_simple(),
          "name": player.name
        }
      })
      .to_string(),
    )
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  if !response.status().is_success() {
    return Err(AccountError::Expired)?;
  }

  let content = response
    .json::<Value>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  let access_token = content["accessToken"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();

  let profile = content["selectedProfile"].clone();

  let id = profile["id"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();

  get_profile(
    app,
    player.auth_server_url.clone().unwrap_or_default(),
    access_token,
    id,
    player.auth_account.clone().unwrap_or_default(),
    player.password.clone().unwrap_or_default(),
  )
  .await
}
