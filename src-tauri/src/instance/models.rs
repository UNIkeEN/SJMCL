use crate::launcher_config::models::GameConfig;
use serde::{Deserialize, Serialize};
use std::{
  cmp::{Ord, Ordering, PartialOrd},
  fmt,
  path::PathBuf,
  str::FromStr,
};

#[derive(Debug, Deserialize, Serialize)]
pub enum InstanceSubdirType {
  Assets,
  Libraries,
  Mods,
  ResourcePacks,
  Root,
  Saves,
  Schematics,
  Screenshots,
  ServerResourcePacks,
  ShaderPacks,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
pub enum ModLoaderType {
  #[default]
  Unknown,
  Fabric,
  Forge,
  ForgeOld,
  NeoForge,
  LiteLoader,
  Quilt,
}
impl FromStr for ModLoaderType {
  type Err = String; // 定义错误类型

  fn from_str(input: &str) -> Result<Self, Self::Err> {
    match input.to_lowercase().as_str() {
      "unknown" => Ok(ModLoaderType::Unknown),
      "fabric" => Ok(ModLoaderType::Fabric),
      "forge" => Ok(ModLoaderType::Forge),
      "forgeold" => Ok(ModLoaderType::ForgeOld),
      "neoforge" => Ok(ModLoaderType::NeoForge),
      "liteloader" => Ok(ModLoaderType::LiteLoader),
      "quilt" => Ok(ModLoaderType::Quilt),
      _ => Err(format!("Unsupported ModLoaderType: {}", input)),
    }
  }
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
      pub loader_type: ModLoaderType,
      pub version: String,
    },
    pub spec_game_config: Option<GameConfig>, // TODO: any sub-config can be None?
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

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LocalModInfo {
  pub icon_src: String,
  pub enabled: bool,
  pub name: String,
  pub translated_name: Option<String>,
  pub version: String,
  pub loader_type: ModLoaderType,
  pub file_name: String,
  pub file_path: PathBuf,
  pub description: String,
  pub potential_incompatibility: bool,
}

impl PartialEq for LocalModInfo {
  fn eq(&self, other: &Self) -> bool {
    self.name.to_lowercase() == other.name.to_lowercase() && self.version == other.version
  }
}

impl Eq for LocalModInfo {}

impl PartialOrd for LocalModInfo {
  fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
    Some(self.cmp(other))
  }
}
impl Ord for LocalModInfo {
  fn cmp(&self, other: &Self) -> Ordering {
    match self.name.to_lowercase().cmp(&other.name.to_lowercase()) {
      Ordering::Equal => self.version.cmp(&other.version),
      order => order,
    }
  }
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
  InstanceNotFoundByID,
  ExecOpenDirError,
  ServerNbtReadError,
  FileNotFoundError,
  InvalidSourcePath,
  FileCopyFailed,
  FileMoveFailed,
  FolderCreationFailed,
}

impl fmt::Display for InstanceError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      InstanceError::InstanceNotFoundByID => write!(f, "INSTANCE_NOT_FOUND_BY_ID"),
      InstanceError::ExecOpenDirError => write!(f, "EXEC_OPEN_DIR_ERROR"),
      InstanceError::ServerNbtReadError => write!(f, "SERVER_NBT_READ_ERROR"),
      InstanceError::FileNotFoundError => write!(f, "FILE_NOT_FOUND_ERROR"),
      InstanceError::InvalidSourcePath => write!(f, "INVALID_SOURCE_PATH"),
      InstanceError::FileCopyFailed => write!(f, "FILE_COPY_FAILED"),
      InstanceError::FileMoveFailed => write!(f, "FILE_MOVE_FAILED"),
      InstanceError::FolderCreationFailed => write!(f, "FOLDER_CREATION_FAILED"),
    }
  }
}

impl std::error::Error for InstanceError {}
