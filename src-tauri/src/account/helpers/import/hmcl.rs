use crate::account::helpers::authlib_injector::common::parse_profile;
use crate::account::helpers::authlib_injector::info::fetch_auth_server_info;
use crate::account::helpers::authlib_injector::models::{
  MinecraftProfile, MinecraftProfileProperty,
};
use crate::account::helpers::import::model::{
  HmclAccountEntry, HmclMicrosoftAccount, HmclOfflineAccount, HmclThirdPartyAccount,
};
use crate::account::helpers::microsoft::oauth::fetch_minecraft_profile;
use crate::account::helpers::misc::fetch_image;
use crate::account::helpers::offline::load_preset_skin;
use crate::account::models::{
  AccountError, AccountInfo, AuthServerInfo, PlayerInfo, PlayerType, PresetRole, SkinModel,
  Texture, TextureType,
};
use crate::error::SJMCLResult;
use std::collections::HashSet;
use std::fs;
use std::str::FromStr;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

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

pub async fn import_hmcl_accounts(app: &AppHandle) -> SJMCLResult<AccountInfo> {
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
    return Ok(AccountInfo::default());
  }

  let hmcl_json = fs::read_to_string(&hmcl_json_path).map_err(|_| AccountError::NotFound)?;
  let hmcl_entries: Vec<HmclAccountEntry> =
    serde_json::from_str(&hmcl_json).map_err(|_| AccountError::Invalid)?;
  let mut players: Vec<PlayerInfo> = Vec::new();
  let mut url_set: HashSet<String> = HashSet::new();
  for e in &hmcl_entries {
    match e {
      HmclAccountEntry::Offline(acc) => {
        players.push(offline_to_player(app, acc).await?);
      }
      HmclAccountEntry::Microsoft(acc) => {
        players.push(microsoft_to_player(app, acc).await?);
      }
      HmclAccountEntry::ThirdParty(acc) => {
        url_set.insert(acc.server_base_url.clone());
        players.push(thirdparty_to_player(app, acc).await?);
      }
    }
  }
  // urls fetch -> AuthServerInfo
  let mut auth_servers: Vec<AuthServerInfo> = Vec::new();
  for url in url_set {
    let s = fetch_auth_server_info(app, url).await?;
    auth_servers.push(AuthServerInfo {
      auth_url: s.auth_url,
      client_id: s.client_id,
      metadata: s.metadata,
      timestamp: s.timestamp,
    });
  }

  Ok(AccountInfo {
    players,
    auth_servers,
    is_oauth_processing: false,
  })
}
