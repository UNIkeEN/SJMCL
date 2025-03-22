use crate::{
  account::{
    constants::TEXTURE_ROLES,
    models::{AccountError, PlayerInfo, PlayerType, Texture},
  },
  error::SJMCLResult,
  utils::image::image_to_base64,
};
use rand::seq::IndexedRandom;
use std::fs;
use tauri::{path::BaseDirectory, AppHandle, Manager};
use uuid::Uuid;

pub fn load_preset_skin(app: &AppHandle, preset_role: String) -> SJMCLResult<Vec<Texture>> {
  let texture_path = app
    .path()
    .resolve(
      format!("assets/skins/{}.png", preset_role),
      BaseDirectory::Resource,
    )
    .map_err(|_| AccountError::TextureError)?;

  // Read the file as bytes
  let texture_bytes = fs::read(texture_path).map_err(|_| AccountError::TextureError)?;

  // Load the image from bytes
  let texture_img =
    image::load_from_memory(&texture_bytes).map_err(|_| AccountError::TextureError)?;

  Ok(vec![Texture {
    texture_type: "SKIN".to_string(),
    image: image_to_base64(texture_img.into())?,
    model: "default".to_string(),
  }])
}

pub async fn login(app: &AppHandle, username: String) -> SJMCLResult<PlayerInfo> {
  let name_with_prefix = format!("OfflinePlayer:{}", username);
  let uuid = Uuid::new_v5(&Uuid::NAMESPACE_URL, name_with_prefix.as_bytes());

  let texture_role = TEXTURE_ROLES.choose(&mut rand::rng()).unwrap_or(&"steve");

  Ok(PlayerInfo {
    name: username,
    uuid,
    player_type: PlayerType::Offline,
    auth_account: "".to_string(),
    password: "".to_string(),
    auth_server_url: "".to_string(),
    access_token: "".to_string(),
    textures: load_preset_skin(app, texture_role.to_string())?,
  })
}
