use super::{
  constants::ACCOUNTS_FILE_NAME,
  helpers::{authlib_injector::constants::PRESET_AUTH_SERVERS, skin::draw_avatar},
};
use crate::{storage::Storage, utils::image::ImageWrapper, APP_DATA_DIR};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use strum_macros::Display;
use uuid::Uuid;

#[derive(Debug, PartialEq, Eq, Clone, Serialize, Deserialize)]
pub enum PlayerType {
  #[serde(rename = "offline")]
  Offline,
  #[serde(rename = "3rdparty")]
  ThirdParty,
  #[serde(rename = "microsoft")]
  Microsoft,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Texture {
  pub texture_type: String,
  pub image: ImageWrapper,
  pub model: String,
  pub preset: Option<String>,
}

// only for the client
#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Player {
  pub id: String,
  pub name: String,
  pub uuid: Uuid,
  pub avatar: ImageWrapper,
  pub player_type: PlayerType,
  pub auth_account: Option<String>,
  pub password: Option<String>,
  pub auth_server: Option<AuthServer>,
  pub access_token: Option<String>,
  pub refresh_token: Option<String>,
  pub textures: Vec<Texture>,
}

impl From<PlayerInfo> for Player {
  fn from(player_info: PlayerInfo) -> Self {
    let state: AccountInfo = Storage::load().unwrap_or_default();

    let auth_server = if let Some(auth_server_url) = player_info.auth_server_url {
      Some(AuthServer::from(
        state
          .auth_servers
          .iter()
          .find(|server| server.auth_url == auth_server_url)
          .cloned()
          .unwrap_or_default(),
      ))
    } else {
      None
    };

    Player {
      id: player_info.id,
      name: player_info.name,
      uuid: player_info.uuid,
      avatar: draw_avatar(36, &player_info.textures[0].image.image).into(),
      player_type: player_info.player_type,
      auth_account: player_info.auth_account,
      password: player_info.password,
      access_token: player_info.access_token,
      refresh_token: player_info.refresh_token,
      auth_server,
      textures: player_info.textures,
    }
  }
}

// for backend storage, without saving the whole auth server info
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlayerInfo {
  pub id: String,
  pub name: String,
  pub uuid: Uuid,
  pub player_type: PlayerType,
  pub auth_account: Option<String>,
  pub password: Option<String>,
  pub auth_server_url: Option<String>,
  pub access_token: Option<String>,
  pub refresh_token: Option<String>,
  pub textures: Vec<Texture>,
}

impl PlayerInfo {
  /// Generate ID from existing fields and return updated struct
  pub fn with_generated_id(mut self) -> Self {
    let server_identity = match self.player_type {
      PlayerType::Offline => "OFFLINE".to_string(),
      PlayerType::Microsoft => "MICROSOFT".to_string(),
      _ => self.auth_server_url.clone().unwrap_or_default(),
    };
    self.id = format!("{}:{}:{}", self.name, server_identity, self.uuid);
    self
  }
}

impl From<Player> for PlayerInfo {
  fn from(player: Player) -> Self {
    PlayerInfo {
      id: player.id,
      name: player.name,
      uuid: player.uuid,
      player_type: player.player_type,
      auth_account: player.auth_account,
      password: player.password,
      textures: player.textures,
      access_token: player.access_token,
      refresh_token: player.refresh_token,
      auth_server_url: player
        .auth_server
        .as_ref()
        .map(|server| server.auth_url.clone()),
    }
  }
}

impl PartialEq for PlayerInfo {
  fn eq(&self, another: &PlayerInfo) -> bool {
    self.name == another.name && self.auth_server_url == another.auth_server_url
  }
}

impl Eq for PlayerInfo {}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OAuthCodeResponse {
  pub device_code: String,
  pub user_code: String,
  pub verification_uri: String,
  pub interval: u64,
}

structstruck::strike! {
  #[strikethrough[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]]
  #[strikethrough[serde(rename_all = "camelCase", deny_unknown_fields)]]
  pub struct AuthServer {
    pub name: String,
    pub auth_url: String,
    pub homepage_url: String,
    pub register_url: String,
    pub features: struct {
      pub non_email_login: bool,
      pub openid_configuration_url: String,
    },
    pub client_id: String,
  }
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AuthServerInfo {
  pub auth_url: String,
  pub client_id: String,
  pub metadata: Value,
  pub timestamp: u64,
}

impl From<AuthServerInfo> for AuthServer {
  fn from(info: AuthServerInfo) -> Self {
    AuthServer {
      name: info.metadata["meta"]["serverName"]
        .as_str()
        .unwrap_or_default()
        .to_string(),
      auth_url: info.auth_url,
      homepage_url: info.metadata["meta"]["links"]["homepage"]
        .as_str()
        .unwrap_or_default()
        .to_string(),
      register_url: info.metadata["meta"]["links"]["register"]
        .as_str()
        .unwrap_or_default()
        .to_string(),
      features: Features {
        non_email_login: info.metadata["meta"]["feature.non_email_login"]
          .as_bool()
          .unwrap_or(false),
        openid_configuration_url: info.metadata["meta"]["feature.openid_configuration_url"]
          .as_str()
          .unwrap_or_default()
          .to_string(),
      },
      client_id: info.client_id,
    }
  }
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountInfo {
  pub players: Vec<PlayerInfo>,
  pub auth_servers: Vec<AuthServerInfo>,
  pub is_oauth_processing: bool,
}

impl Default for AccountInfo {
  fn default() -> Self {
    AccountInfo {
      players: vec![],
      auth_servers: PRESET_AUTH_SERVERS
        .iter()
        .map(|url| AuthServerInfo {
          auth_url: url.to_string(),
          client_id: "".to_string(),
          metadata: Value::Null,
          timestamp: 0,
        })
        .collect(),
      is_oauth_processing: false,
    }
  }
}

impl AccountInfo {
  pub fn get_player_by_id_mut(&mut self, id: String) -> Option<&mut PlayerInfo> {
    self.players.iter_mut().find(|player| player.id == id)
  }
}

impl Storage for AccountInfo {
  fn file_path() -> PathBuf {
    APP_DATA_DIR.get().unwrap().join(ACCOUNTS_FILE_NAME)
  }
}

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum AccountError {
  Duplicate,
  Expired,
  Invalid,
  NotFound,
  TextureError,
  NetworkError,
  ParseError,
  Cancelled,
  NoDownloadApi,
  SaveError,
  NoMinecraftProfile,
}

impl std::error::Error for AccountError {}
