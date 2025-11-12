use crate::account::helpers::microsoft::models::MinecraftProfile;
use crate::account::helpers::misc::fetch_image;
use crate::account::helpers::texture::{load_preset_skin_info, TextureOperation};
use crate::account::models::{
  AccountError, PlayerInfo, PresetRole, SkinModel, Texture, TextureType,
};
use crate::error::SJMCLResult;
use crate::utils::image::load_image_from_dir;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use tauri_plugin_http::reqwest::multipart::{Form, Part};

pub struct MicrosoftTextureOperation;

impl TextureOperation<MinecraftProfile> for MicrosoftTextureOperation {
  async fn parse_skin(app: &AppHandle, profile: &MinecraftProfile) -> SJMCLResult<Vec<Texture>> {
    let mut textures = vec![];
    if let Some(skins) = &profile.skins {
      for skin in skins {
        if skin.state == "ACTIVE" {
          textures.push(Texture {
            texture_type: TextureType::Skin,
            image: fetch_image(app, skin.url.clone()).await?,
            model: skin.variant.clone().unwrap_or_default(),
            preset: None,
          });
        }
      }
    }
    if let Some(capes) = &profile.capes {
      for cape in capes {
        if cape.state == "ACTIVE" {
          textures.push(Texture {
            texture_type: TextureType::Cape,
            image: fetch_image(app, cape.url.clone()).await?,
            model: SkinModel::Default,
            preset: None,
          });
        }
      }
    }

    if textures.is_empty() {
      // this player didn't have a texture, use preset Steve skin instead
      let (skin_path, model) = load_preset_skin_info(app, PresetRole::Steve)?;
      textures = vec![Texture {
        texture_type: TextureType::Skin,
        image: load_image_from_dir(&skin_path)
          .ok_or(AccountError::TextureFormatIncorrect)?
          .into(),
        model,
        preset: Some(PresetRole::Steve),
      }];
    }
    Ok(textures)
  }

  async fn upload_skin(
    app: &AppHandle,
    player: &PlayerInfo,
    file_path: &Path,
    model: SkinModel,
  ) -> SJMCLResult<MinecraftProfile> {
    let client = app.state::<reqwest::Client>();
    let variant = if model == SkinModel::Slim {
      "slim"
    } else {
      "classic"
    };
    let file = fs::read(file_path).map_err(|_| AccountError::TextureFormatIncorrect)?;
    let form = Form::new().text("variant", variant).part(
      "file",
      Part::bytes(file)
        .file_name("skin.png")
        .mime_str("image/png")
        .map_err(|_| AccountError::TextureFormatIncorrect)?,
    );

    let response = client
      .post("https://api.minecraftservices.com/minecraft/profile/skins")
      .bearer_auth(player.access_token.clone().unwrap_or_default())
      .multipart(form)
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if !response.status().is_success() {
      log::error!("Failed to upload skin: {}", response.status());
      return Err(AccountError::NoTextureApi.into());
    }

    Ok(
      response
        .json::<MinecraftProfile>()
        .await
        .map_err(|_| AccountError::ParseError)?,
    )
  }

  async fn delete_skin(app: &AppHandle, player: &PlayerInfo) -> SJMCLResult<MinecraftProfile> {
    let client = app.state::<reqwest::Client>();

    let response = client
      .delete("https://api.minecraftservices.com/minecraft/profile/skins/active")
      .bearer_auth(player.access_token.clone().unwrap_or_default())
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if !response.status().is_success() {
      log::error!("Failed to delete skin: {}", response.status());
      return Err(AccountError::NoTextureApi.into());
    }

    Ok(
      response
        .json::<MinecraftProfile>()
        .await
        .map_err(|_| AccountError::ParseError)?,
    )
  }

  async fn upload_cape(
    _app: &AppHandle,
    _player: &PlayerInfo,
    _file_path: &Path,
  ) -> SJMCLResult<MinecraftProfile> {
    Err(AccountError::NoTextureApi.into())
  }

  async fn delete_cape(app: &AppHandle, player: &PlayerInfo) -> SJMCLResult<MinecraftProfile> {
    let client = app.state::<reqwest::Client>();

    let response = client
      .delete("https://api.minecraftservices.com/minecraft/profile/capes/active")
      .header("Accept", "application/json")
      .bearer_auth(player.access_token.clone().unwrap_or_default())
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if !response.status().is_success() {
      log::error!("Failed to delete cape: {}", response.status());
      return Err(AccountError::NoTextureApi.into());
    }

    Ok(
      response
        .json::<MinecraftProfile>()
        .await
        .map_err(|_| AccountError::ParseError)?,
    )
  }
}
