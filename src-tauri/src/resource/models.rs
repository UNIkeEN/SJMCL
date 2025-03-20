use crate::instance::models::misc::ModLoaderType;
use serde::{Deserialize, Serialize};
use strum_macros::Display;

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
  NeoforgeMetaForge,    // old version, only for 1.20.1
  NeoforgeMetaNeoforge, // new version
  NeoforgedForge,
  NeoforgedNeoforge,
  QuiltMaven,
  QuiltMeta,
}

#[derive(Eq, Hash, PartialEq, Clone, Copy, Debug)]
pub enum SourceType {
  Official,
  BMCLAPIMirror,
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

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum ResourceError {
  ParseError,
  NoDownloadApi,
  NetworkError,
}

impl std::error::Error for ResourceError {}
