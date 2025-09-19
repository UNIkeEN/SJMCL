use serde::{Deserialize, Serialize};
use std::fs::File;

use super::curseforge::CurseForgeManifest;
use super::modrinth::ModrinthManifest;
use crate::error::SJMCLResult;
use crate::instance::models::misc::{InstanceError, ModLoader};
use crate::resource::models::OtherResourceSource;

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModpackMetaInfo {
  pub name: String,
  pub version: String,
  pub description: Option<String>,
  pub author: Option<String>,
  pub modpack_source: OtherResourceSource,
  pub client_version: String,
  pub mod_loader: ModLoader,
}

impl ModpackMetaInfo {
  pub async fn from_archive(file: &File) -> SJMCLResult<Self> {
    if let Ok(manifest) = CurseForgeManifest::from_archive(file) {
      let client_version = manifest.get_client_version();
      let (loader_type, version) = manifest.get_mod_loader_type_version();
      Ok(ModpackMetaInfo {
        modpack_source: OtherResourceSource::CurseForge,
        name: manifest.name,
        version: manifest.version,
        description: None,
        author: Some(manifest.author),
        client_version,
        mod_loader: ModLoader {
          loader_type,
          version,
          ..Default::default()
        },
      })
    } else if let Ok(manifest) = ModrinthManifest::from_archive(file) {
      let client_version = manifest.get_client_version()?;
      let (loader_type, version) = manifest.get_mod_loader_type_version()?;
      Ok(ModpackMetaInfo {
        modpack_source: OtherResourceSource::Modrinth,
        name: manifest.name,
        version: manifest.version_id,
        description: manifest.summary,
        author: None,
        client_version,
        mod_loader: ModLoader {
          loader_type,
          version,
          ..Default::default()
        },
      })
    } else {
      Err(InstanceError::ModpackManifestParseError.into())
    }
  }
}
