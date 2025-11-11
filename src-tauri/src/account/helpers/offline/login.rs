use crate::account::helpers::texture::load_preset_skin_info;
use crate::account::models::{
  AccountError, PlayerInfo, PlayerType, PresetRole, Texture, TextureType,
};
use crate::error::SJMCLResult;
use crate::utils::image::load_image_from_dir;
use rand::seq::IteratorRandom;
use strum::IntoEnumIterator;
use tauri::AppHandle;
use uuid::Uuid;

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
  let (preset_skin_path, model) = load_preset_skin_info(app, preset_role.clone())?;
  let skin_img =
    load_image_from_dir(&preset_skin_path).ok_or(AccountError::TextureFormatIncorrect)?;

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
      textures: vec![Texture {
        texture_type: TextureType::Skin,
        image: skin_img.into(),
        model,
        preset: Some(preset_role),
      }],
    }
    .with_generated_id(),
  )
}
