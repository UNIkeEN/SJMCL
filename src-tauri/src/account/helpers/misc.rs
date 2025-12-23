use crate::account::constants::DEFAULT_POLLING_INTERVAL;
use crate::account::helpers::authlib_injector::common::parse_profile;
use crate::account::helpers::authlib_injector::info::fetch_auth_server_info;
use crate::account::helpers::authlib_injector::models::{
  MinecraftProfile, MinecraftProfileProperty,
};
use crate::account::helpers::microsoft::oauth::fetch_minecraft_profile;
use crate::account::helpers::offline::load_preset_skin;
use crate::account::models::{
  AccountEntry, AccountError, AccountInfo, AuthServerInfo, DeviceAuthResponseInfo,
  MicrosoftAccount, OAuthErrorResponse, OAuthTokens, OfflineAccount, PlayerInfo, PlayerType,
  PresetRole, SkinModel, Texture, TextureType, ThirdPartyAccount,
};
use crate::error::SJMCLResult;
use crate::launcher_config::models::LauncherConfig;
use crate::storage::Storage;
use crate::utils::image::{decode_image, ImageWrapper};
use crate::utils::web::is_china_mainland_ip;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::str::FromStr;
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest::{self, RequestBuilder};
use uuid::Uuid;

pub async fn fetch_image(app: &AppHandle, url: String) -> SJMCLResult<ImageWrapper> {
  let client = app.state::<reqwest::Client>();

  let response = client
    .get(url)
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  let img_bytes = response
    .bytes()
    .await
    .map_err(|_| AccountError::ParseError)?
    .to_vec();

  Ok(
    decode_image(img_bytes)
      .map_err(|_| AccountError::ParseError)?
      .into(),
  )
}

pub fn get_selected_player_info(app: &AppHandle) -> SJMCLResult<PlayerInfo> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  let account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let config_state = config_binding.lock()?;

  let selected_player_id = &config_state.states.shared.selected_player_id;
  if selected_player_id.is_empty() {
    return Err(AccountError::NotFound.into());
  }

  let player_info = account_state
    .players
    .iter()
    .find(|player| player.id == *selected_player_id)
    .ok_or(AccountError::NotFound)?;

  Ok(player_info.clone())
}

pub async fn check_full_login_availability(app: &AppHandle) -> SJMCLResult<()> {
  let loc_flag = is_china_mainland_ip(app).await;

  let account_binding = app.state::<Mutex<AccountInfo>>();
  let account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;

  match loc_flag {
    Some(true) => {
      // in China (mainland), full account feature (offline and 3rd-party login) is always available
      config_state.partial_update(
        app,
        "basic_info.allow_full_login_feature",
        &serde_json::to_string(&true)?,
      )?;
    }
    _ => {
      // not in China (mainland) or cannot determine the IP
      // check if any player has been added (not only microsoft type player, because user may delete it)
      config_state.partial_update(
        app,
        "basic_info.allow_full_login_feature",
        &serde_json::to_string(&!account_state.players.is_empty())?,
      )?;
    }
  }

  config_state.save()?;
  Ok(())
}

pub async fn oauth_polling(
  app: &AppHandle,
  sender: RequestBuilder,
  auth_info: DeviceAuthResponseInfo,
) -> SJMCLResult<OAuthTokens> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  {
    let mut account_state = account_binding.lock()?;
    account_state.is_oauth_processing = true;
  }
  let mut interval = auth_info.interval.unwrap_or(DEFAULT_POLLING_INTERVAL);
  let start_time = std::time::Instant::now();
  loop {
    {
      let account_state = account_binding.lock()?;
      if !account_state.is_oauth_processing {
        return Err(AccountError::Cancelled)?;
      }
    }

    let response = sender
      .try_clone()
      .ok_or(AccountError::NetworkError)?
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if response.status().is_success() {
      return Ok(
        response
          .json()
          .await
          .map_err(|_| AccountError::ParseError)?,
      );
    } else {
      if response.status().as_u16() != 400 {
        return Err(AccountError::NetworkError)?;
      }

      let error_response: OAuthErrorResponse = response
        .json()
        .await
        .map_err(|_| AccountError::ParseError)?;

      match error_response.error.as_str() {
        "authorization_pending" => {
          // continue polling
        }
        "slow_down" => {
          interval += 5;
        }
        "access_denied" => {
          return Err(AccountError::Cancelled)?;
        }
        "expired_token" => {
          return Err(AccountError::Expired)?;
        }
        _ => {
          return Err(AccountError::NetworkError)?;
        }
      }
    }

    if start_time.elapsed().as_secs() >= auth_info.expires_in {
      return Err(AccountError::Expired)?;
    }

    tokio::time::sleep(std::time::Duration::from_secs(interval)).await;
  }
}

async fn offline_to_player(app: &AppHandle, acc: &OfflineAccount) -> SJMCLResult<PlayerInfo> {
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

async fn microsoft_to_player(app: &AppHandle, acc: &MicrosoftAccount) -> SJMCLResult<PlayerInfo> {
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

async fn thirdparty_to_player(app: &AppHandle, acc: &ThirdPartyAccount) -> SJMCLResult<PlayerInfo> {
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
  let hmcl_entries: Vec<AccountEntry> =
    serde_json::from_str(&hmcl_json).map_err(|_| AccountError::Invalid)?;
  let mut players: Vec<PlayerInfo> = Vec::new();
  let mut url_set: HashSet<String> = HashSet::new();
  for e in &hmcl_entries {
    match e {
      AccountEntry::Offline(acc) => {
        players.push(offline_to_player(app, acc).await?);
      }
      AccountEntry::Microsoft(acc) => {
        players.push(microsoft_to_player(app, acc).await?);
      }
      AccountEntry::ThirdParty(acc) => {
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
