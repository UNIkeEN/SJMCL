use crate::account::helpers::authlib_injector::common::parse_profile;
use crate::account::helpers::authlib_injector::models::{
  MinecraftProfile, MinecraftProfileProperty,
};
use crate::account::helpers::microsoft::oauth::fetch_minecraft_profile;
use crate::account::helpers::misc::fetch_image;
use crate::account::helpers::offline::load_preset_skin;
use crate::account::models::{
  AccountError, PlayerInfo, PlayerType, PresetRole, SkinModel, Texture, TextureType,
};
use crate::error::SJMCLResult;
use serde::Deserialize;
use std::collections::HashSet;
use std::fs;
use std::str::FromStr;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use url::Url;
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
pub struct HmclOfflineAccount {
  pub uuid: String,
  pub username: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HmclMicrosoftAccount {
  pub uuid: String,
  pub display_name: String,
  pub token_type: String,
  pub access_token: String,
  pub refresh_token: String,
  pub not_after: i64,
  pub userid: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct HmclProfileProperties {
  pub textures: Option<String>,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HmclThirdPartyAccount {
  #[serde(rename = "serverBaseURL")]
  pub server_base_url: String,
  pub client_token: String,
  pub display_name: String,
  pub access_token: String,
  pub profile_properties: HmclProfileProperties,
  pub uuid: String,
  pub username: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum HmclAccountEntry {
  #[serde(rename = "offline")]
  Offline(HmclOfflineAccount),
  #[serde(rename = "microsoft")]
  Microsoft(HmclMicrosoftAccount),
  #[serde(rename = "authlibInjector")]
  ThirdParty(HmclThirdPartyAccount),
}

async fn offline_to_player(app: &AppHandle, acc: &HmclOfflineAccount) -> SJMCLResult<PlayerInfo> {
  let uuid = uuid::Uuid::parse_str(&acc.uuid).map_err(|_| AccountError::ParseError)?;
  let textures = load_preset_skin(app, PresetRole::Steve)?;
  Ok(
    PlayerInfo {
      id: "".to_string(),
      uuid,
      name: acc.username.clone(),
      player_type: PlayerType::Offline,
      auth_account: None,
      auth_server_url: None,
      access_token: None,
      refresh_token: None,
      textures,
    }
    .with_generated_id(),
  )
}

async fn microsoft_to_player(
  app: &AppHandle,
  acc: &HmclMicrosoftAccount,
) -> SJMCLResult<PlayerInfo> {
  let profile = fetch_minecraft_profile(app, acc.access_token.clone()).await?;

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
    textures = load_preset_skin(app, PresetRole::Steve)?;
  }

  Ok(
    PlayerInfo {
      id: "".to_string(),
      uuid: Uuid::from_str(&profile.id).map_err(|_| AccountError::ParseError)?,
      name: profile.name.clone(),
      player_type: PlayerType::Microsoft,
      auth_account: Some(profile.name.clone()),
      access_token: Some(acc.access_token.clone()),
      refresh_token: Some(acc.refresh_token.clone()),
      textures,
      auth_server_url: None,
    }
    .with_generated_id(),
  )
}

async fn thirdparty_to_player(
  app: &AppHandle,
  acc: &HmclThirdPartyAccount,
) -> SJMCLResult<PlayerInfo> {
  let profile = MinecraftProfile {
    id: acc.uuid.clone(),
    name: acc.display_name.clone(),
    properties: Some(vec![MinecraftProfileProperty {
      name: "textures".to_string(),
      value: acc.profile_properties.textures.clone().unwrap_or_default(),
    }]),
  };
  let p = parse_profile(
    app,
    &profile,
    Some(acc.access_token.clone()),
    None,
    Some(acc.server_base_url.clone()),
    Some(acc.username.clone()),
  )
  .await?;
  Ok(p)
}

pub async fn retrieve_hmcl_account_info(
  app: &AppHandle,
) -> SJMCLResult<(Vec<PlayerInfo>, Vec<Url>)> {
  let hmcl_json_path = if cfg!(target_os = "linux") {
    app
      .path()
      .resolve("", BaseDirectory::Home)?
      .join(".hmcl")
      .join("accounts.json")
  } else {
    let app_data = app.path().resolve("", BaseDirectory::AppData)?;
    let base = app_data
      .parent()
      .ok_or(AccountError::NotFound)?
      .to_path_buf();
    if cfg!(target_os = "macos") {
      base.join("hmcl").join("accounts.json")
    } else {
      base.join(".hmcl").join("accounts.json")
    }
  };

  if !hmcl_json_path.is_file() {
    return Ok((vec![], vec![]));
  }

  let hmcl_json = fs::read_to_string(&hmcl_json_path).map_err(|_| AccountError::NotFound)?;

  let hmcl_entries: Vec<HmclAccountEntry> =
    serde_json::from_str(&hmcl_json).map_err(|_| AccountError::Invalid)?;
  let mut player_infos: Vec<PlayerInfo> = Vec::new();
  let mut url_set: HashSet<Url> = HashSet::new();

  for e in &hmcl_entries {
    match e {
      HmclAccountEntry::Offline(acc) => {
        player_infos.push(offline_to_player(app, acc).await?);
      }
      HmclAccountEntry::Microsoft(acc) => {
        player_infos.push(microsoft_to_player(app, acc).await?);
      }
      HmclAccountEntry::ThirdParty(acc) => {
        if let Ok(url) = Url::parse(&acc.server_base_url) {
          url_set.insert(url);
        }
        player_infos.push(thirdparty_to_player(app, acc).await?);
      }
    }
  }

  Ok((player_infos, url_set.into_iter().collect()))
}
