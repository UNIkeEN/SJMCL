use crate::instance::models::misc::ModLoaderType;
use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumIter};

#[derive(Eq, Hash, PartialEq, Clone, Copy, Debug, EnumIter)]
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
  ForgeMavenNew,
  ForgeInstall,
  Liteloader,
  Optifine,
  AuthlibInjector,
  FabricMeta,
  FabricMaven,
  NeoforgeMetaForge,    // old version, only for 1.20.1
  NeoforgeMetaNeoforge, // new version
  NeoforgeInstall,
  NeoforgeMaven,
  QuiltMaven,
  QuiltMeta,
}

#[derive(Eq, Hash, PartialEq, Clone, Copy, Debug, EnumIter)]
pub enum SourceType {
  Official,
  BMCLAPIMirror,
}

// mod, save, resourcepack and shader
#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OtherResourceInfo {
  pub id: String,
  pub _type: String,
  pub name: String,
  pub description: String,
  pub icon_src: String,
  pub tags: Vec<String>,
  pub last_updated: String,
  pub downloads: u32,
  pub source: String,
  pub website_url: String,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OtherResourceSearchRes {
  pub list: Vec<OtherResourceInfo>,
  pub total: u32,
  pub page: u32,
  pub page_size: u32,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OtherResourceSearchQuery {
  pub resource_type: String,
  pub search_query: String,
  pub game_version: String,
  pub selected_tag: String,
  pub sort_by: String,
  pub page: u32,
  pub page_size: u32,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OtherResourceVersionPackQuery {
  pub resource_id: String,
  pub mod_loader: String,
  pub game_versions: Vec<String>,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OtherResourceFileInfo {
  pub resource_id: String,
  pub name: String,
  pub release_type: String,
  pub downloads: u32,
  pub file_date: String,
  pub download_url: String,
  pub sha1: String,
  pub file_name: String,
  pub loader: Option<String>,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OtherResourceVersionPack {
  pub name: String,
  pub items: Vec<OtherResourceFileInfo>,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModUpdateQuery {
  pub url: String,
  pub sha1: String,
  pub file_name: String,
  pub old_file_path: String,
}

// game client itself
#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GameClientResourceInfo {
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
  pub branch: Option<String>,
}

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum ResourceError {
  ParseError,
  NoDownloadApi,
  NetworkError,
  FileOperationError,
}

impl std::error::Error for ResourceError {}
