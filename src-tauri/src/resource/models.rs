use crate::instance::models::misc::ModLoaderType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
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

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
pub enum OtherResourceSource {
  #[default]
  Unknown,
  CurseForge,
  Modrinth,
}

impl FromStr for OtherResourceSource {
  type Err = String;

  fn from_str(input: &str) -> Result<Self, Self::Err> {
    match input.to_lowercase().as_str() {
      "curseforge" => Ok(OtherResourceSource::CurseForge),
      "modrinth" => Ok(OtherResourceSource::Modrinth),
      _ => Err(format!("Unknown resource download type: {}", input)),
    }
  }
}

// Enum to represent different request types
#[allow(dead_code)]
pub enum OtherResourceRequestType<'a, P> {
  GetWithParams(&'a HashMap<String, String>),
  Get,
  Post(&'a P),
}

#[derive(Debug, Clone, Copy)]
pub enum OtherResourceApiEndpoint {
  Search,
  VersionPack,
  FromLocal,
  ById,
  TranslateDesc,
}

// mod, save, resourcepack, datapack and shader
#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OtherResourceInfo {
  pub id: String,
  pub mcmod_id: u32,
  pub _type: String,
  pub name: String,
  pub slug: String,
  pub translated_name: Option<String>,
  pub description: String,
  pub translated_description: Option<String>,
  pub icon_src: String,
  pub tags: Vec<String>,
  pub last_updated: String,
  pub downloads: u32,
  pub source: OtherResourceSource,
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
  pub dependencies: Vec<OtherResourceDependency>,
  pub loader: Option<String>,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OtherResourceDependency {
  pub resource_id: String,
  pub relation: String,
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
  ClientVersionNotFound,
}

impl std::error::Error for ResourceError {}
