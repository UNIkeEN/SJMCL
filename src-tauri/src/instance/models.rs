use crate::launcher_config::models::GameConfig;
use serde::{Deserialize, Serialize};
use std::{
  ffi::{OsStr, OsString},
  fmt::{self, write},
  path::PathBuf,
};

#[derive(Debug, Deserialize, Serialize)]
pub enum InstanceSubdirType {
  Assets,
  Libraries,
  Mods,
  ResourcePacks,
  ServerResourcePacks,
  Saves,
  Schematics,
  Screenshots,
  ShaderPacks,
  GameRoot,
}

structstruck::strike! {
  #[strikethrough[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]]
  #[strikethrough[serde(rename_all = "camelCase", deny_unknown_fields)]]
  pub struct Instance {
    pub id: usize,
    pub name: String,
    pub description: String,
    pub icon_src: String,
    pub version: String,
    pub version_path: PathBuf,
    pub mod_loader: struct {
      pub loader_type: String,
      pub version: String,
    },
    pub has_schem_folder: bool,
    pub game_config: Option<GameConfig>, // TODO: any sub-config can be None?
  }
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorldInfo {
  pub name: String,
  pub last_played_at: i64,
  pub difficulty: String,
  pub gamemode: String,
  pub icon_src: PathBuf,
  pub dir_path: PathBuf,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GameServerInfo {
  pub icon_src: String,
  pub ip: String,
  pub name: String,
  pub is_queried: bool, // if true, this is a complete result from a successful query
  pub players_online: usize,
  pub players_max: usize,
  pub online: bool, // if false, it may be offline in the query result or failed in the query.
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResourcePackInfo {
  pub name: String,
  pub description: String,
  pub icon_src: Option<String>,
  pub file_path: PathBuf,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SchematicInfo {
  pub name: String,
  pub file_path: PathBuf,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShaderPackInfo {
  pub file_name: String,
  pub file_path: PathBuf,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScreenshotInfo {
  pub file_name: String,
  pub file_path: PathBuf,
  pub time: u64,
}

#[derive(Debug)]
pub enum InstanceError {
  SubdirTypeNotFound,
  ExecOpenDirError,
  ServerNbtReadError,
}

impl fmt::Display for InstanceError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      InstanceError::SubdirTypeNotFound => write!(f, "SUBDIR_TYPE_NOT_FOUND"),
      InstanceError::ExecOpenDirError => write!(f, "EXEC_OPEN_DIR_ERROR"),
      InstanceError::ServerNbtReadError => write!(f, "SERVER_NBT_READ_ERROR"),
    }
  }
}

impl std::error::Error for InstanceError {}
