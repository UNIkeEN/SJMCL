use crate::account::helpers::authlib_injector::common::retrieve_profile;
use crate::account::helpers::authlib_injector::models::{MinecraftProfile, TextureInfo};
use crate::account::helpers::misc::fetch_image;
use crate::account::helpers::texture::{load_preset_skin_info, TextureOperation};
use crate::account::models::{
  AccountError, PlayerInfo, PresetRole, SkinModel, Texture, TextureType,
};
use crate::error::SJMCLResult;
use crate::utils::image::load_image_from_dir;
use base64::engine::general_purpose;
use base64::Engine;
use std::fs;
use std::path::Path;
use std::str::FromStr;
use strum::IntoEnumIterator;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use tauri_plugin_http::reqwest::multipart::{Form, Part};

pub struct AuthlibInjectorTextureOperation;

impl TextureOperation<MinecraftProfile> for AuthlibInjectorTextureOperation {
  async fn parse_skin(app: &AppHandle, profile: &MinecraftProfile) -> SJMCLResult<Vec<Texture>> {
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

      for texture_type in TextureType::iter() {
        if let Some(skin) = texture_info_value.textures.get(&texture_type.to_string()) {
          textures.push(Texture {
            image: fetch_image(app, skin.url.clone()).await?,
            texture_type,
            model: skin
              .metadata
              .as_ref()
              .and_then(|metadata| metadata.get("model").cloned())
              .map(|model_str| SkinModel::from_str(&model_str).unwrap_or(SkinModel::Default))
              .unwrap_or_default(),
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
    let auth_server_url = player.auth_server_url.clone().unwrap_or_default();
    let id = player.uuid.as_simple();
    let model = if model == SkinModel::Slim { "slim" } else { "" };
    let filename = file_path
      .file_name()
      .unwrap_or_default()
      .to_string_lossy()
      .to_string();
    let file = fs::read(file_path).map_err(|_| AccountError::TextureFormatIncorrect)?;
    let form = Form::new().text("model", model).part(
      "file",
      Part::bytes(file)
        .file_name(filename)
        .mime_str("image/png")
        .map_err(|_| AccountError::TextureFormatIncorrect)?,
    );

    let response = client
      .put(format!(
        "{}/api/user/profile/{}/skin",
        auth_server_url.clone(),
        id.clone()
      ))
      .bearer_auth(player.access_token.clone().unwrap_or_default())
      .multipart(form)
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if !response.status().is_success() {
      log::error!("Failed to upload skin: {}", response.status());
      return Err(AccountError::NoTextureApi.into());
    }

    retrieve_profile(app, auth_server_url, id.to_string()).await
  }

  async fn delete_skin(app: &AppHandle, player: &PlayerInfo) -> SJMCLResult<MinecraftProfile> {
    let client = app.state::<reqwest::Client>();
    let auth_server_url = player.auth_server_url.clone().unwrap_or_default();
    let id = player.uuid.as_simple();

    let response = client
      .delete(format!(
        "{}/api/user/profile/{}/skin",
        auth_server_url.clone(),
        id.clone()
      ))
      .bearer_auth(player.access_token.clone().unwrap_or_default())
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if !response.status().is_success() {
      log::error!("Failed to delete skin: {}", response.status());
      return Err(AccountError::NoTextureApi.into());
    }

    retrieve_profile(app, auth_server_url, id.to_string()).await
  }

  async fn upload_cape(
    app: &AppHandle,
    player: &PlayerInfo,
    file_path: &Path,
  ) -> SJMCLResult<MinecraftProfile> {
    let client = app.state::<reqwest::Client>();
    let auth_server_url = player.auth_server_url.clone().unwrap_or_default();
    let id = player.uuid.as_simple();
    let filename = file_path
      .file_name()
      .unwrap_or_default()
      .to_string_lossy()
      .to_string();
    let file = fs::read(file_path).map_err(|_| AccountError::TextureFormatIncorrect)?;
    let form = Form::new().text("model", "").part(
      "file",
      Part::bytes(file)
        .file_name(filename)
        .mime_str("image/png")
        .map_err(|_| AccountError::TextureFormatIncorrect)?,
    );

    let response = client
      .put(format!(
        "{}/api/user/profile/{}/cape",
        auth_server_url.clone(),
        id.clone()
      ))
      .bearer_auth(player.access_token.clone().unwrap_or_default())
      .multipart(form)
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if !response.status().is_success() {
      log::error!("Failed to upload cape: {}", response.status());
      return Err(AccountError::NoTextureApi.into());
    }

    retrieve_profile(app, auth_server_url, id.to_string()).await
  }

  async fn delete_cape(app: &AppHandle, player: &PlayerInfo) -> SJMCLResult<MinecraftProfile> {
    let client = app.state::<reqwest::Client>();
    let auth_server_url = player.auth_server_url.clone().unwrap_or_default();
    let id = player.uuid.as_simple();

    let response = client
      .delete(format!(
        "{}/api/user/profile/{}/cape",
        auth_server_url.clone(),
        id.clone()
      ))
      .bearer_auth(player.access_token.clone().unwrap_or_default())
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if !response.status().is_success() {
      log::error!("Failed to delete cape: {}", response.status());
      return Err(AccountError::NoTextureApi.into());
    }

    retrieve_profile(app, auth_server_url, id.to_string()).await
  }
}
