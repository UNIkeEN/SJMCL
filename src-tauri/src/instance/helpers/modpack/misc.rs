use crate::error::SJMCLResult;
use crate::instance::helpers::modpack::curseforge::CurseForgeManifest;
use crate::instance::helpers::modpack::modrinth::ModrinthManifest;
use crate::instance::helpers::modpack::multimc::MultiMcManifest;
use crate::instance::models::misc::{InstanceError, ModLoader};
use crate::resource::models::OtherResourceSource;
use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::File;
use std::path::Path;
use zip::ZipArchive;

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
    } else if let Ok(manifest) = MultiMcManifest::from_archive(file) {
      let client_version = manifest.get_client_version()?;
      let (loader_type, version) = manifest.get_mod_loader_type_version()?;
      Ok(ModpackMetaInfo {
        modpack_source: OtherResourceSource::Modrinth,
        name: manifest.cfg.get("name").cloned().unwrap_or_default(),
        version: String::new(),
        description: None,
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

pub fn extract_overrides(
  overrides_path: &String,
  file: &File,
  instance_path: &Path,
) -> SJMCLResult<()> {
  let mut archive = ZipArchive::new(file)?;
  for i in 0..archive.len() {
    let mut file = archive.by_index(i)?;
    let path = file.mangled_name();
    let outpath = if path.starts_with(format!("{}/", overrides_path)) {
      // Remove "{overrides}/" prefix and join with instance path
      let relative_path = path.strip_prefix(format!("{}/", overrides_path)).unwrap();
      instance_path.join(relative_path)
    } else {
      continue;
    };

    if file.is_file() {
      // Create parent directories if they don't exist
      if let Some(p) = outpath.parent() {
        if !p.exists() {
          fs::create_dir_all(p)?;
        }
      }

      // Extract file
      let mut outfile = File::create(&outpath)?;
      std::io::copy(&mut file, &mut outfile)?;
    }
  }
  Ok(())
}
