use serde::{Deserialize, Serialize};
use std::fmt;

// only for the client
#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Player {
  pub name: String,
  pub uuid: String,
  pub avatar_src: String,
  pub player_type: String,
  #[serde(default)]
  pub auth_account: String,
  #[serde(default)]
  pub password: String,
  #[serde(default)]
  pub auth_server: AuthServer,
}

// for backend storage, without saving the whole auth server info
#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlayerInfo {
  pub name: String,
  pub uuid: String,
  pub avatar_src: String,
  pub player_type: String,
  #[serde(default)]
  pub auth_account: String,
  #[serde(default)]
  pub password: String,
  #[serde(default)]
  pub auth_server_url: String,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AuthServer {
  pub name: String,
  pub auth_url: String,
  pub mutable: bool,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountInfo {
  pub players: Vec<PlayerInfo>,
  pub auth_servers: Vec<AuthServer>,
}

#[derive(Debug)]
pub enum AuthServerError {
  DuplicateServer,
  InvalidServer,
  NotFound,
}

impl fmt::Display for AuthServerError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      AuthServerError::InvalidServer => write!(f, "INVALID_SERVER"),
      AuthServerError::DuplicateServer => write!(f, "DUPLICATE_SERVER"),
      AuthServerError::NotFound => write!(f, "NOT_FOUND"),
    }
  }
}
