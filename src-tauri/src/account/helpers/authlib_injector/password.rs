use super::common::parse_profile;
use crate::{
  account::models::{AccountError, PlayerInfo},
  error::SJMCLResult,
};
use serde_json::{json, Value};
use tauri::AppHandle;
use tauri_plugin_http::reqwest;

async fn get_profile(
  app: AppHandle,
  auth_server_url: String,
  access_token: String,
  id: String,
  auth_account: String,
  password: String,
) -> SJMCLResult<PlayerInfo> {
  let profile = reqwest::get(format!(
    "{}/sessionserver/session/minecraft/profile/{}",
    auth_server_url, id
  ))
  .await
  .map_err(|_| AccountError::AuthServerError)?
  .json::<Value>()
  .await
  .map_err(|_| AccountError::AuthServerError)?;

  parse_profile(
    app,
    profile,
    access_token,
    auth_server_url,
    auth_account,
    password,
  )
  .await
}

pub async fn login(
  app: AppHandle,
  auth_server_url: String,
  username: String,
  password: String,
) -> SJMCLResult<Vec<PlayerInfo>> {
  let client = reqwest::Client::new();

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
    .map_err(|_| AccountError::AuthServerError)?;

  if !response.status().is_success() {
    return Err(AccountError::Invalid.into());
  }

  let content = response
    .json::<Value>()
    .await
    .map_err(|_| AccountError::AuthServerError)?;

  let available_profiles: Vec<Value> = match content["availableProfiles"].as_array() {
    Some(arr) => arr.clone(),
    None => vec![],
  };

  let access_token = content["accessToken"]
    .as_str()
    .unwrap_or_default()
    .to_string();

  let mut players = vec![];

  for profile in available_profiles {
    let id = profile["id"]
      .as_str()
      .ok_or(AccountError::AuthServerError)?
      .to_string();

    let player = get_profile(
      app.clone(),
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
