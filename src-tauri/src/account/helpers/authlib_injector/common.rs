use crate::{
  account::{
    helpers::offline::load_preset_skin,
    models::{AccountError, PlayerInfo, PlayerType, Texture},
  },
  error::SJMCLResult,
  utils::image::decode_image,
};
use base64::{engine::general_purpose, Engine};
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_http::reqwest;
use uuid::Uuid;

pub async fn parse_profile(
  app: &AppHandle,
  profile: Value,
  access_token: String,
  refresh_token: String,
  auth_server_url: String,
  auth_account: String,
  password: String,
) -> SJMCLResult<PlayerInfo> {
  let uuid = Uuid::parse_str(profile["id"].as_str().unwrap_or_default())
    .map_err(|_| AccountError::ParseError)?;

  let name = profile["name"].as_str().unwrap_or_default();

  let properties = profile["properties"]
    .as_array()
    .ok_or(AccountError::ParseError)?;

  let mut textures: Vec<Texture> = vec![];

  if let Some(texture_info_base64) = properties
    .iter()
    .find(|property| property["name"] == "textures")
  {
    let texture_info = general_purpose::STANDARD
      .decode(texture_info_base64["value"].as_str().unwrap_or_default())
      .map_err(|_| AccountError::ParseError)?
      .into_iter()
      .map(|b| b as char)
      .collect::<String>();

    let texture_info_value: Value =
      serde_json::from_str(&texture_info).map_err(|_| AccountError::ParseError)?;

    const TEXTURE_TYPES: [&str; 2] = ["SKIN", "CAPE"];

    for texture_type in TEXTURE_TYPES {
      if let Some(skin) = texture_info_value["textures"].get(texture_type) {
        let img_url = skin["url"].as_str().unwrap_or_default();
        if img_url.is_empty() {
          continue;
        }
        let img_bytes = reqwest::get(img_url)
          .await
          .map_err(|_| AccountError::NetworkError)?
          .bytes()
          .await
          .map_err(|_| AccountError::ParseError)?;

        textures.push(Texture {
          image: decode_image(img_bytes.to_vec())?.into(),
          texture_type: texture_type.to_string(),
          model: skin["metadata"]["model"]
            .as_str()
            .unwrap_or("default")
            .to_string(),
        });
      }
    }
  } else {
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

pub async fn validate(player: &PlayerInfo) -> SJMCLResult<()> {
  let client = reqwest::Client::new();

  let response = client
    .post(format!(
      "{}/authserver/validate",
      player.auth_server_url.clone()
    ))
    .form(&[("accessToken", player.access_token.clone())])
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  if !response.status().is_success() {
    return Err(AccountError::Expired)?;
  }

  Ok(())
}
