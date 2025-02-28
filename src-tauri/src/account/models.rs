use super::helpers::{
  authlib_injector::info::{fetch_auth_url, get_client_id},
  skin::draw_avatar,
};
use crate::{storage::Storage, utils::image::base64_to_image, EXE_DIR};
use futures::executor::block_on;
use serde::{Deserialize, Serialize};
use std::{fmt, path::PathBuf};
use uuid::Uuid;

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Texture {
  pub texture_type: String,
  pub image: String, // base64 encoded
  pub model: String,
}

// only for the client
#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Player {
  pub name: String,
  pub uuid: Uuid,
  pub avatar: String, // base64 encoded
  pub player_type: String,
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
#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlayerInfo {
  pub name: String,
  pub uuid: Uuid,
  pub player_type: String,
  pub auth_account: String,
  pub password: String,
  pub auth_server_url: String,
  pub access_token: String,
  pub textures: Vec<Texture>,
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
  pub selected_player_id: String, // maybe "" if none of the player was selected
  pub auth_servers: Vec<AuthServer>,
}

impl Storage for AccountInfo {
  fn file_path() -> PathBuf {
    EXE_DIR.join("sjmcl.account.json")
  }
}

impl Default for AccountInfo {
  fn default() -> Self {
    let sjmc_auth_url = block_on(fetch_auth_url("https://skin.mc.sjtu.cn".to_string()))
      .unwrap_or_else(|_| "".to_string());
    let mua_auth_url = block_on(fetch_auth_url(
      "https://skin.mualliance.ltd/api/yggdrasil".to_string(),
    ))
    .unwrap_or_else(|_| "".to_string());

    AccountInfo {
      players: Vec::new(),
      selected_player_id: String::new(),
      auth_servers: vec![
        AuthServer {
          name: "SJMC 用户中心".to_string(),
          auth_url: sjmc_auth_url,
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
          auth_url: mua_auth_url,
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

#[derive(Debug)]
pub enum AccountError {
  Duplicate,
  Invalid,
  NotFound,
  TextureError,
  AuthServerError,
  Cancelled,
}

impl fmt::Display for AccountError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      AccountError::Duplicate => write!(f, "DUPLICATE"),
      AccountError::Invalid => write!(f, "INVALID"),
      AccountError::NotFound => write!(f, "NOT_FOUND"),
      AccountError::TextureError => write!(f, "TEXTURE_ERROR"),
      AccountError::AuthServerError => write!(f, "AUTH_SERVER_ERROR"),
      AccountError::Cancelled => write!(f, "CANCELLED"),
    }
  }
}

impl std::error::Error for AccountError {}
