use crate::{
  account::{
    constants::TEXTURE_TYPES,
    helpers::offline::load_preset_skin,
    models::{AccountError, PlayerInfo, Texture},
  },
  error::SJMCLResult,
};
use base64::{engine::general_purpose, Engine};
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_http::reqwest;
use uuid::Uuid;

pub async fn parse_profile(
  app: AppHandle,
  profile: Value,
  access_token: String,
  auth_server_url: String,
  auth_account: String,
  password: String,
) -> SJMCLResult<PlayerInfo> {
  let uuid = Uuid::parse_str(profile["id"].as_str().unwrap_or_default())
    .map_err(|_| AccountError::AuthServerError)?;

  let name = profile["name"].as_str().unwrap_or_default();

  let properties = profile["properties"]
    .as_array()
    .ok_or(AccountError::AuthServerError)?;

  let mut textures: Vec<Texture> = vec![];

  if let Some(texture_info_base64) = properties
    .iter()
    .find(|property| property["name"] == "texture")
  {
    let texture_info = general_purpose::STANDARD
      .decode(texture_info_base64["value"].as_str().unwrap_or_default())
      .map_err(|_| AccountError::AuthServerError)?
      .into_iter()
      .map(|b| b as char)
      .collect::<String>();

    let texture_info_value: Value =
      serde_json::from_str(&texture_info).map_err(|_| AccountError::AuthServerError)?;

    for texture_type in TEXTURE_TYPES {
      if let Some(skin) = texture_info_value["textures"].get(texture_type) {
        let img_url = skin["url"].as_str().unwrap_or_default();
        let img_bytes = reqwest::get(img_url)
          .await
          .map_err(|_| AccountError::AuthServerError)?
          .bytes()
          .await
          .map_err(|_| AccountError::AuthServerError)?;

        textures.push(Texture {
          image: general_purpose::STANDARD.encode(img_bytes),
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

  Ok(PlayerInfo {
    uuid,
    name: name.to_string(),
    player_type: "3rdparty".to_string(),
    auth_account,
    access_token,
    textures,
    password,
    auth_server_url,
  })
}
