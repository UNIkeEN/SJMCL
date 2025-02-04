use std::fmt;

use serde::{Deserialize, Serialize};

pub enum ResourceType {
  Game,
  Forge,
  Fabric,
  NeoForge,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GameResourceInfo {
  pub id: String,
  pub game_type: String,
  pub release_time: String,
  pub url: String,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModLoaderResourceInfo {
  pub loader_type: String,
  pub version: String,
  pub description: String,
  pub stable: bool,
}

#[derive(Debug)]
pub enum ResourceError {
  FetchError,
  ParseError,
}

impl fmt::Display for ResourceError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      ResourceError::FetchError => write!(f, "FETCH_ERROR"),
      ResourceError::ParseError => write!(f, "PARSE_ERROR"),
    }
  }
}

impl std::error::Error for ResourceError {}
