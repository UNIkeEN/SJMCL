pub mod yggdrasil_server;

use crate::account::models::{
  AccountError, PlayerInfo, PlayerType, PresetRole, SkinModel, Texture, TextureType,
};
use crate::error::SJMCLResult;
use crate::utils::fs::get_app_resource_filepath;
use crate::utils::image::load_image_from_dir;
use rand::seq::IteratorRandom;
use strum::IntoEnumIterator;
use tauri::AppHandle;
use uuid::Uuid;

pub fn load_preset_skin(app: &AppHandle, preset_role: PresetRole) -> SJMCLResult<Vec<Texture>> {
  let texture_path = get_app_resource_filepath(
    app,
    &format!("assets/skins/{}.png", preset_role.to_string()),
  )
  .map_err(|_| AccountError::TextureError)?;

  let texture_img = load_image_from_dir(&texture_path).ok_or(AccountError::TextureError)?;

  Ok(vec![Texture {
    texture_type: TextureType::Skin,
    image: texture_img.into(),
    model: if preset_role == PresetRole::Alex {
      SkinModel::Slim
    } else {
      SkinModel::Default
    },
    preset: Some(preset_role),
  }])
}

pub async fn login(app: &AppHandle, username: String, raw_uuid: String) -> SJMCLResult<PlayerInfo> {
  let name_with_prefix = format!("OfflinePlayer:{}", username);
  let uuid = if let Ok(id) = Uuid::parse_str(&raw_uuid) {
    id
  } else {
    if !raw_uuid.is_empty() {
      // user uses custom UUID, but it's invalid
      return Err(AccountError::Invalid)?;
    }
    Uuid::new_v5(&Uuid::NAMESPACE_URL, name_with_prefix.as_bytes())
  };
  let preset_role = PresetRole::iter()
    .choose(&mut rand::rng())
    .unwrap_or(PresetRole::Steve);

  Ok(
    PlayerInfo {
      id: "".to_string(),
      name: username.clone(),
      uuid,
      player_type: PlayerType::Offline,
      auth_account: None,
      auth_server_url: None,
      access_token: None,
      refresh_token: None,
      textures: load_preset_skin(app, preset_role)?,
    }
    .with_generated_id(),
  )
}
