use std::{
  collections::HashMap,
  fs::{self, File},
  io::Read,
  path::Path,
};

use serde::{Deserialize, Serialize};
use zip::ZipArchive;

use crate::{
  error::SJMCLResult,
  instance::models::misc::{InstanceError, ModLoaderType},
  tasks::{download::DownloadParam, RuntimeTaskParam},
};

structstruck::strike! {
#[strikethrough[derive(Deserialize, Serialize, Debug, Clone)]]
#[strikethrough[serde(rename_all = "camelCase")]]
pub struct ModrinthFile {
  pub path: String,
  pub hashes: struct {
    pub sha1: String,
    pub sha512: String,
  },
  pub env: Option<pub struct {
    pub client: String,
    pub server: String,
  }>,
  pub downloads: Vec<String>,
  pub file_size: u64,
}
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthManifest {
  pub version_id: String,
  pub name: String,
  pub summary: Option<String>,
  pub files: Vec<ModrinthFile>,
  pub dependencies: HashMap<String, String>,
}

impl ModrinthManifest {
  pub fn from_archive(file: &File) -> SJMCLResult<Self> {
    let mut archive = ZipArchive::new(file)?;
    let mut manifest_file = archive.by_name("modrinth.index.json")?;
    let mut manifest_content = String::new();
    manifest_file.read_to_string(&mut manifest_content)?;
    let manifest: Self = serde_json::from_str(&manifest_content).inspect_err(|e| {
      eprintln!("{:?}", e);
    })?;
    Ok(manifest)
  }

  pub fn get_client_version(&self) -> SJMCLResult<String> {
    Ok(
      self
        .dependencies
        .get("minecraft")
        .ok_or(InstanceError::ModpackManifestParseError)?
        .to_string(),
    )
  }

  pub fn get_mod_loader_type_version(&self) -> SJMCLResult<(ModLoaderType, String)> {
    for (key, val) in &self.dependencies {
      match key.as_str() {
        "minecraft" => continue,
        "forge" => return Ok((ModLoaderType::Forge, val.to_string())),
        "fabric-loader" => return Ok((ModLoaderType::Fabric, val.to_string())),
        "neoforge" => return Ok((ModLoaderType::NeoForge, val.to_string())),
        _ => return Err(InstanceError::UnsupportedModLoader.into()),
      }
    }
    Err(InstanceError::ModpackManifestParseError.into())
  }

  pub fn extract_overrides(&self, file: &File, instance_path: &Path) -> SJMCLResult<()> {
    let mut archive = ZipArchive::new(file)?;
    for i in 0..archive.len() {
      let mut file = archive.by_index(i)?;
      let outpath = match file.enclosed_name() {
        Some(path) => {
          if path.starts_with("overrides/") {
            // Remove "overrides/" prefix and join with instance path
            let relative_path = path.strip_prefix("overrides/").unwrap();
            instance_path.join(relative_path)
          } else {
            continue;
          }
        }
        None => continue,
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

  pub fn get_download_params(&self, instance_path: &Path) -> SJMCLResult<Vec<RuntimeTaskParam>> {
    self
      .files
      .iter()
      .map(|file| {
        let download_url = file
          .downloads
          .first()
          .ok_or(InstanceError::InvalidSourcePath)?;
        Ok(RuntimeTaskParam::Download(DownloadParam {
          src: url::Url::parse(download_url).map_err(|_| InstanceError::InvalidSourcePath)?,
          sha1: Some(file.hashes.sha1.clone()),
          dest: instance_path.join(&file.path),
          filename: None,
        }))
      })
      .collect::<SJMCLResult<Vec<_>>>()
  }
}
