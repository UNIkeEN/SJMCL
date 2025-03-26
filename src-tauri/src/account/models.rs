use super::helpers::{authlib_injector::info::get_client_id, skin::draw_avatar};
use crate::{storage::Storage, utils::image::base64_to_image, EXE_DIR};
use serde::{Deserialize, Serialize};
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
  pub image: String, // base64 encoded
  pub model: String,
}

// only for the client
#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Player {
  pub id: String,
  pub name: String,
  pub uuid: Uuid,
  pub avatar: String, // base64 encoded
  pub player_type: PlayerType,
  #[serde(default)]
  pub auth_account: String,
  #[serde(default)]
  pub password: String,
  #[serde(default)]
  pub auth_server: AuthServer,
  pub textures: Vec<Texture>,
}

impl From<PlayerInfo> for Player {
  fn from(player_info: PlayerInfo) -> Self {
    let state: AccountInfo = Storage::load().unwrap_or_default();
    let auth_server = state
      .auth_servers
      .iter()
      .find(|server| server.auth_url == player_info.auth_server_url)
      .cloned()
      .unwrap_or_default();
    Player {
      id: player_info.id,
      name: player_info.name,
      uuid: player_info.uuid,
      avatar: draw_avatar(
        36,
        base64_to_image(player_info.textures[0].image.clone()).unwrap_or_default(),
      )
      .unwrap_or_default(),
      player_type: player_info.player_type,
      auth_account: player_info.auth_account,
      password: player_info.password,
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
  pub auth_account: String,
  pub password: String,
  pub auth_server_url: String,
  pub access_token: String,
  pub textures: Vec<Texture>,
}

#[allow(clippy::too_many_arguments)]
impl PlayerInfo {
  pub fn new(
    name: String,
    uuid: Uuid,
    player_type: PlayerType,
    auth_server_url: String,
    auth_account: String,
    password: String,
    access_token: String,
    textures: Vec<Texture>,
  ) -> Self {
    let mut server_identity = auth_server_url.clone();
    if player_type == PlayerType::Offline {
      server_identity = "OFFLINE".to_string();
    } else if player_type == PlayerType::Microsoft {
      server_identity = "MICROSOFT".to_string();
    }
    let player_id = format!("{}:{}:{}", name, server_identity, uuid);

    PlayerInfo {
      id: player_id,
      name,
      uuid,
      player_type,
      auth_account,
      password,
      auth_server_url,
      access_token,
      textures,
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

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountInfo {
  pub players: Vec<PlayerInfo>,
  pub auth_servers: Vec<AuthServer>,
}

impl AccountInfo {
  pub fn get_player_by_id(&self, id: String) -> Option<&PlayerInfo> {
    self.players.iter().find(|player| player.id == id)
  }
}

impl Storage for AccountInfo {
  fn file_path() -> PathBuf {
    EXE_DIR.join("sjmcl.account.json")
  }
}

impl Default for AccountInfo {
  fn default() -> Self {
    AccountInfo {
      players: Vec::new(),
      auth_servers: vec![
        AuthServer {
          name: "SJMC 用户中心".to_string(),
          auth_url: "https://skin.mc.sjtu.cn/api/yggdrasil".to_string(),
          homepage_url: "https://skin.mc.sjtu.cn".to_string(),
          register_url: "https://skin.mc.sjtu.cn/auth/register".to_string(),
          features: Features {
            non_email_login: true,
            openid_configuration_url:
              "https://skin.mc.sjtu.cn/open/.well-known/openid-configuration".to_string(),
          },
          client_id: get_client_id("skin.mc.sjtu.cn".to_string()),
        },
        AuthServer {
          name: "MUA 用户中心".to_string(),
          auth_url: "https://skin.mualliance.ltd/api/yggdrasil".to_string(),
          homepage_url: "https://skin.mualliance.ltd".to_string(),
          register_url: "https://skin.mualliance.ltd/auth/register".to_string(),
          features: Features {
            non_email_login: true,
            openid_configuration_url: "".to_string(),
          },
          client_id: get_client_id("skin.mualliance.ltd".to_string()),
        },
      ],
    }
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
  CreateWebviewError,
}

impl std::error::Error for AccountError {}
