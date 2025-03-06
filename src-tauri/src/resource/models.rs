use crate::instance::models::misc::ModLoaderType;
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Eq, Hash, PartialEq, Clone, Copy, Debug)]
pub enum ResourceType {
  VersionManifest,
  VersionManifestV2,
  LauncherMeta,
  Launcher,
  Assets,
  Libraries,
  MojangJava,
  ForgeMaven,
  ForgeMeta,
  Liteloader,
  Optifine,
  AuthlibInjector,
  FabricMeta,
  FabricMaven,
  NeoforgeMeta,
  NeoforgedForge,
  NeoforgedNeoforge,
  QuiltMaven,
  QuiltMeta,
}

#[derive(Eq, Hash, PartialEq, Clone, Copy, Debug)]
pub enum SourceType {
  Official,
  ChineseMirror,
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
  pub loader_type: ModLoaderType,
  pub version: String,
  pub description: String,
  pub stable: bool,
}

#[derive(Debug)]
pub enum ResourceError {
  ParseError,
  NoDownloadApi,
}

impl fmt::Display for ResourceError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      ResourceError::ParseError => write!(f, "PARSE_ERROR"),
      ResourceError::NoDownloadApi => write!(f, "NO_DOWNLOAD_API"),
    }
  }
}

impl std::error::Error for ResourceError {}
