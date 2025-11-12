use crate::account::helpers::authlib_injector::models::MinecraftProfile;
use crate::account::helpers::authlib_injector::texture::AuthlibInjectorTextureOperation;
use crate::account::helpers::authlib_injector::{oauth, password};
use crate::account::helpers::texture::TextureOperation;
use crate::account::models::{AccountError, AuthServer, PlayerInfo, PlayerType};
use crate::error::SJMCLResult;
use serde_json::json;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use uuid::Uuid;

pub async fn retrieve_profile(
  app: &AppHandle,
  auth_server_url: String,
  id: String,
) -> SJMCLResult<MinecraftProfile> {
  let client = app.state::<reqwest::Client>();
  Ok(
    client
      .get(format!(
        "{}/sessionserver/session/minecraft/profile/{}",
        auth_server_url, id
      ))
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?
      .json::<MinecraftProfile>()
      .await
      .map_err(|_| AccountError::ParseError)?,
  )
}

pub async fn parse_profile(
  app: &AppHandle,
  profile: &MinecraftProfile,
  access_token: Option<String>,
  refresh_token: Option<String>,
  auth_server_url: Option<String>,
  auth_account: Option<String>,
) -> SJMCLResult<PlayerInfo> {
  let uuid = Uuid::parse_str(&profile.id).map_err(|_| AccountError::ParseError)?;
  let name = profile.name.clone();

  Ok(
    PlayerInfo {
      id: "".to_string(),
      uuid,
      name: name.to_string(),
      player_type: PlayerType::ThirdParty,
      auth_account,
      access_token,
      refresh_token,
      textures: AuthlibInjectorTextureOperation::parse_skin(app, profile).await?,
      auth_server_url,
    }
    .with_generated_id(),
  )
}

pub async fn validate(app: &AppHandle, player: &PlayerInfo) -> SJMCLResult<bool> {
  let client = app.state::<reqwest::Client>();

  let response = client
    .post(format!(
      "{}/authserver/validate",
      player.auth_server_url.clone().unwrap_or_default()
    ))
    .json(&json!({
      "accessToken": player.access_token.clone()
    }))
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  Ok(response.status().is_success())
}

pub async fn refresh(
  app: &AppHandle,
  player: &PlayerInfo,
  auth_server: &AuthServer,
) -> SJMCLResult<PlayerInfo> {
  if player.refresh_token.is_none() || Some("") == player.refresh_token.as_deref() {
    // to be compatible with legacy version of account config
    password::refresh(app, player, false).await
  } else {
    oauth::refresh(
      app,
      player,
      auth_server.client_id.clone(),
      auth_server.features.openid_configuration_url.clone(),
    )
    .await
  }
}
