use super::constants::TEXTURE_TYPES;
use super::models::{MinecraftProfile, TextureInfo};
use super::{oauth, password};
use crate::account::helpers::misc::fetch_image;
use crate::account::helpers::offline::load_preset_skin;
use crate::account::models::{AccountError, AuthServer, PlayerInfo, PlayerType, Texture};
use crate::error::SJMCLResult;
use base64::engine::general_purpose;
use base64::Engine;
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
  password: Option<String>,
) -> SJMCLResult<PlayerInfo> {
  let uuid = Uuid::parse_str(&profile.id).map_err(|_| AccountError::ParseError)?;
  let name = profile.name.clone();
  let mut textures: Vec<Texture> = vec![];

  if let Some(texture_info_base64) = profile
    .properties
    .as_ref()
    .and_then(|props| props.iter().find(|property| property.name == "textures"))
  {
    let texture_info = general_purpose::STANDARD
      .decode(texture_info_base64.value.clone())
      .map_err(|_| AccountError::ParseError)?
      .into_iter()
      .map(|b| b as char)
      .collect::<String>();

    let texture_info_value: TextureInfo =
      serde_json::from_str(&texture_info).map_err(|_| AccountError::ParseError)?;

    for texture_type in TEXTURE_TYPES {
      if let Some(skin) = texture_info_value.textures.get(texture_type) {
        textures.push(Texture {
          image: fetch_image(app, skin.url.clone()).await?,
          texture_type: texture_type.to_string(),
          model: skin
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("model").cloned())
            .unwrap_or("default".into()),
          preset: None,
        });
      }
    }
  }

  if textures.is_empty() {
    // this player didn't have a texture, use preset Steve skin instead
    textures = load_preset_skin(app, "steve".to_string())?;
  }

  Ok(
    PlayerInfo {
      id: "".to_string(),
      uuid,
      name: name.to_string(),
      player_type: PlayerType::ThirdParty,
      auth_account,
      access_token,
      refresh_token,
      textures,
      password,
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
