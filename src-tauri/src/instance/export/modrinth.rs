use crate::error::SJMCLResult;
use crate::instance::export::common::ExportModpackOptions;
use crate::instance::models::misc::{Instance, ModLoaderType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthManifest {
  pub format_version: u32,
  pub game: String,
  pub version_id: String,
  pub name: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub summary: Option<String>,
  pub files: Vec<ModrinthFile>,
  pub dependencies: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthFile {
  pub path: String,
  pub hashes: ModrinthHashes,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub env: Option<ModrinthEnv>,
  pub downloads: Vec<String>,
  pub file_size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthHashes {
  pub sha1: String,
  pub sha512: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthEnv {
  pub client: String,
}

/// Generate a Modrinth format manifest for the instance
pub fn generate_modrinth_manifest(
  instance: &Instance,
  options: &ExportModpackOptions,
) -> SJMCLResult<ModrinthManifest> {
  let mut dependencies = HashMap::new();

  // Add Minecraft version
  dependencies.insert("minecraft".to_string(), instance.version.clone());

  // Add mod loader if present
  if instance.mod_loader.loader_type != ModLoaderType::Unknown {
    let version = &instance.mod_loader.version;
    let loader_key = match instance.mod_loader.loader_type {
      ModLoaderType::Forge | ModLoaderType::LegacyForge => "forge",
      ModLoaderType::Fabric => "fabric-loader",
      ModLoaderType::NeoForge => "neoforge",
      ModLoaderType::Quilt => "quilt-loader",
      _ => "",
    };

    if !loader_key.is_empty() {
      dependencies.insert(loader_key.to_string(), version.clone());
    }
  }

  Ok(ModrinthManifest {
    format_version: 1,
    game: "minecraft".to_string(),
    version_id: options.version.clone(),
    name: options.name.clone(),
    summary: options.description.clone(),
    files: Vec::new(),
    dependencies,
  })
}
