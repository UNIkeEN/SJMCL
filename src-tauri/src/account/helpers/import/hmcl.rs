use crate::account::helpers::authlib_injector::common::parse_profile;
use crate::account::helpers::authlib_injector::models::{
  MinecraftProfile, MinecraftProfileProperty,
};
use crate::account::helpers::import::misc::ACCESS_TOKEN_EXPIRED;
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
use base64::{engine::general_purpose::STANDARD, Engine as _};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use serde_json::Value;
use std::collections::HashMap;

const HMCL_PROTECTION_KEY: &[u8; 32] = &[
  0x3c, 0xd8, 0xa2, 0x22,
  0x11, 0xd2, 0x8d, 0x89,
  0xb4, 0xf7, 0xd9, 0xb0,
  0x65, 0xbc, 0x14, 0x8a,
  0x6e, 0xb0, 0xa9, 0x4d,
  0xeb, 0x93, 0x99, 0x6f,
  0x84, 0x07, 0x5a, 0x9e,
  0xbd, 0xc8, 0xd1, 0xeb,
];

#[derive(Deserialize)]
struct HmclAccountsFileV2 {
  accounts: Vec<Value>,
}

#[derive(Deserialize)]
struct HmclPrivateDataFile {
  protection: String,
  nonce: Option<String>,
  payload: Value,
}

#[derive(Deserialize)]
struct PlainPrivateDataEntry {
  #[serde(rename = "accountID")]
  account_id: String,
  #[serde(rename = "privateData")]
  private_data: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HmclOfflineAccount {
  #[serde(rename = "profileID")]
  pub profile_id: String,
  pub profile_name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HmclMicrosoftAccount {
  pub profile_id: String,
  pub profile_name: String,
  pub token_type: String,
  pub access_token: String,
  pub refresh_token: String,
  pub not_after: Option<i64>,
  pub userid: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct HmclProfileProperties {
  pub textures: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HmclThirdPartyAccount {
  pub server_base_url: String,
  pub client_token: String,
  pub login_name: Option<String>,
  pub profile_name: Option<String>,
  pub access_token: String,
  pub profile_properties: Option<HashMap<String, String>>,
  pub profile_id: String,
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
  let uuid = Uuid::parse_str(&acc.profile_id).map_err(|_| AccountError::ParseError)?;
  let textures = load_preset_skin(app, PresetRole::Steve)?;
  Ok(
    PlayerInfo {
      id: "".to_string(),
      uuid,
      name: acc.profile_name.clone(),
      player_type: PlayerType::Offline,
      auth_account: None,
      auth_server_url: None,
      access_token: None,
      access_token_expires: None,
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
  let profile_result = fetch_minecraft_profile(app, acc.access_token.clone()).await;
  let profile = match profile_result {
    Ok(p) => p,
    Err(_) => {
      let name = acc.profile_name.clone();
      return Ok(
        PlayerInfo {
          id: "".to_string(),
          uuid: Uuid::from_str(&acc.profile_id).map_err(|_| AccountError::ParseError)?,
          name,
          player_type: PlayerType::Microsoft,
          auth_account: None,
          access_token: Some(ACCESS_TOKEN_EXPIRED.to_string()),
          access_token_expires: Some(chrono::Utc::now()),
          refresh_token: Some(acc.refresh_token.clone()),
          textures: load_preset_skin(app, PresetRole::Steve)?,
          auth_server_url: None,
        }
            .with_generated_id(),
      );
    }
  };

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
      access_token_expires: Some(
        chrono::DateTime::from_timestamp_millis(acc.not_after.unwrap_or(0)).unwrap_or(chrono::Utc::now()),
      ),
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
  let name = acc.profile_name.clone()
      .or_else(|| acc.login_name.clone())
      .unwrap_or_default();
  let profile = MinecraftProfile {
    id: acc.profile_id.clone(),
    name: name.clone(),
    properties: Some(vec![MinecraftProfileProperty {
      name: "textures".to_string(),
      value: acc.profile_properties.as_ref().and_then(|map| map.get("textures").cloned()).unwrap_or_default(),
    }]),
  };
  let p = parse_profile(
    app,
    &profile,
    Some(acc.access_token.clone()),
    None,
    Some(acc.server_base_url.clone()),
    Some(name),
  )
      .await?;
  Ok(p)
}

fn decrypt_hmcl_payload(nonce_b64: &str, obfuscated_array: &Vec<Value>) -> Option<Vec<PlainPrivateDataEntry>> {
  let mut b64_ciphertext = String::new();
  for item in obfuscated_array {
    if let Some(s) = item.as_str() {
      b64_ciphertext.push_str(s);
    }
  }

  let ciphertext_bytes = STANDARD.decode(&b64_ciphertext).ok()?;
  let nonce_bytes = STANDARD.decode(nonce_b64).ok()?;

  let key = Key::from_slice(HMCL_PROTECTION_KEY);
  let cipher = ChaCha20Poly1305::new(key);
  let nonce = Nonce::from_slice(&nonce_bytes);

  let plaintext_bytes = cipher.decrypt(nonce, ciphertext_bytes.as_ref()).ok()?;
  let plaintext_str = String::from_utf8(plaintext_bytes).ok()?;

  serde_json::from_str(&plaintext_str).ok()
}

pub async fn retrieve_hmcl_account_info(
  app: &AppHandle,
) -> SJMCLResult<(Vec<PlayerInfo>, Vec<Url>)> {
  let hmcl_base_dir = if cfg!(target_os = "linux") {
    app
        .path()
        .resolve("", BaseDirectory::Home)?
        .join(".hmcl")
  } else {
    let app_data = app.path().resolve("", BaseDirectory::AppData)?;
    let base = app_data
        .parent()
        .ok_or(AccountError::NotFound)?
        .to_path_buf();
    if cfg!(target_os = "macos") {
      base.join("hmcl")
    } else {
      base.join(".hmcl")
    }
  };

  let hmcl_account_json_path_new = hmcl_base_dir.join("config").join("user-accounts.json");

  if !hmcl_account_json_path_new.is_file() {
    return Ok((vec![], vec![]));
  }

  let mut player_infos: Vec<PlayerInfo> = Vec::new();
  let mut url_set: HashSet<Url> = HashSet::new();

  let accounts_json_str = fs::read_to_string(&hmcl_account_json_path_new)
      .map_err(|_| AccountError::NotFound)?;
  let new_file: HmclAccountsFileV2 = serde_json::from_str(&accounts_json_str)
      .map_err(|_| AccountError::Invalid)?;
  let account_nodes = new_file.accounts;

  let hmcl_private_data_path = hmcl_base_dir.join("private").join("user-account-private-data.json");
  let mut private_data_map: HashMap<String, Value> = HashMap::new();

  if hmcl_private_data_path.is_file() {
    if let Ok(private_json_str) = fs::read_to_string(&hmcl_private_data_path) {
      if let Ok(priv_file) = serde_json::from_str::<HmclPrivateDataFile>(&private_json_str) {

        let parsed_payload: Option<Vec<PlainPrivateDataEntry>> = match priv_file.protection.as_str() {
          "hmcl-obfuscated-v1" => {
            if let (Some(nonce), Some(arr)) = (priv_file.nonce, priv_file.payload.as_array()) {
              decrypt_hmcl_payload(&nonce, arr)
            } else {
              None
            }
          }
          "plain" => serde_json::from_value(priv_file.payload).ok(),
          _ => None,
        };

        if let Some(entries) = parsed_payload {
          for entry in entries {
            private_data_map.insert(entry.account_id, entry.private_data);
          }
        }
      }
    }
  }

  let mut hmcl_entries: Vec<HmclAccountEntry> = Vec::new();

  for mut node in account_nodes {
    if let Some(account_id) = node.get("accountID").and_then(|v| v.as_str()) {
      if let Some(private_obj) = private_data_map.get(account_id) {
        if let (Some(base_map), Some(priv_map)) = (node.as_object_mut(), private_obj.as_object()) {
          for (k, v) in priv_map {
            base_map.insert(k.clone(), v.clone());
          }
        }
      }
    }

    if let Ok(entry) = serde_json::from_value::<HmclAccountEntry>(node) {
      hmcl_entries.push(entry);
    }
  }

  for e in &hmcl_entries {
    match e {
      HmclAccountEntry::Offline(acc) => {
        if let Ok(p) = offline_to_player(app, acc).await {
          player_infos.push(p);
        }
      }
      HmclAccountEntry::Microsoft(acc) => {
        if let Ok(p) = microsoft_to_player(app, acc).await {
          player_infos.push(p);
        }
      }
      HmclAccountEntry::ThirdParty(acc) => {
        if let Ok(url) = Url::parse(&acc.server_base_url) {
          url_set.insert(url);
        }
        if let Ok(p) = thirdparty_to_player(app, acc).await {
          player_infos.push(p);
        }
      }
    }
  }

  Ok((player_infos, url_set.into_iter().collect()))
}
