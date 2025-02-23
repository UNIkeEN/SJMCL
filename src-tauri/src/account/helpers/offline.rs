use crate::{
  account::models::{AccountError, PlayerInfo, Texture},
  error::SJMCLResult,
  utils::image::image_to_base64,
};
use rand::seq::IndexedRandom;
use std::fs;
use tauri::{path::BaseDirectory, AppHandle, Manager};
use uuid::Uuid;

pub async fn offline_login(app: AppHandle, username: String) -> SJMCLResult<PlayerInfo> {
  let name_with_prefix = format!("OfflinePlayer:{}", username);
  let uuid = Uuid::new_v5(&Uuid::NAMESPACE_URL, name_with_prefix.as_bytes());

  let texture_roles = ["steve", "alex"];
  let texture_role = texture_roles.choose(&mut rand::rng()).unwrap_or(&"steve");

  let texture_path = app
    .path()
    .resolve(
      format!("assets/skins/{}.png", texture_role),
      BaseDirectory::Resource,
    )
    .map_err(|_| AccountError::TextureError)?;

  // Read the file as bytes
  let texture_bytes = fs::read(texture_path).map_err(|_| AccountError::TextureError)?;

  // Load the image from bytes
  let texture_img =
    image::load_from_memory(&texture_bytes).map_err(|_| AccountError::TextureError)?;

  Ok(PlayerInfo {
    name: username,
    uuid,
    player_type: "offline".to_string(),
    auth_account: "".to_string(),
    password: "".to_string(),
    auth_server_url: "".to_string(),
    access_token: "".to_string(),
    textures: vec![Texture {
      texture_type: "SKIN".to_string(),
      image: image_to_base64(texture_img.into())?,
      model: "default".to_string(),
    }],
    uploadable_textures: "skin,cape".to_string(),
  })
}
