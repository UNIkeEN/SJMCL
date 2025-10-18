use crate::error::SJMCLResult;
use crate::instance::models::misc::{InstanceError, ModLoaderType};
use config::Config;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use zip::ZipArchive;

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MultiMcCacheRequires {
  pub uid: String,
  pub equals: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MultiMcComponent {
  pub cached_name: Option<String>,
  pub cached_requires: Option<Vec<MultiMcCacheRequires>>,
  pub cached_version: Option<String>,
  pub important: Option<bool>,
  pub uid: String,
  pub version: String,
}

structstruck::strike! {
#[strikethrough[derive(Deserialize, Serialize, Debug, Clone)]]
#[strikethrough[serde(rename_all = "camelCase")]]
  pub struct MultiMcManifest {
    pub components: Vec<MultiMcComponent>,
    pub format_version: u64,
    #[serde(skip)]
    pub cfg: HashMap<String, String>,
    #[serde(skip)]
    pub base_path: String,
  }
}

impl MultiMcManifest {
  pub fn from_archive(file: &File) -> SJMCLResult<Self> {
    let mut archive = ZipArchive::new(file)?;

    let base_path = Self::find_manifest_path(&mut archive)?;

    let mut manifest: MultiMcManifest;
    {
      let manifest_path = format!("{}mmc-pack.json", base_path);
      let mut manifest_file = archive.by_name(&manifest_path)?;
      let mut manifest_content = String::new();
      manifest_file.read_to_string(&mut manifest_content)?;
      manifest = serde_json::from_str(&manifest_content)?;
    }

    let cfg_path = format!("{}instance.cfg", base_path);
    let mut cfg_file = archive.by_name(&cfg_path)?;
    let mut cfg_str = String::new();
    cfg_file.read_to_string(&mut cfg_str)?;

    let config = Config::builder()
      .add_source(config::File::from_str(&cfg_str, config::FileFormat::Ini))
      .build()?;

    manifest.base_path = base_path;
    manifest.cfg = config.try_deserialize::<HashMap<String, String>>()?;

    Ok(manifest)
  }

  fn find_manifest_path(archive: &mut ZipArchive<&File>) -> SJMCLResult<String> {
    if archive.by_name("mmc-pack.json").is_ok() {
      return Ok(String::new());
    }

    for i in 0..archive.len() {
      let file = archive.by_index(i)?;
      let name = file.name();

      if name.ends_with("mmc-pack.json") {
        if let Some(last_slash) = name.rfind('/') {
          let dir_path = &name[..=last_slash];
          let prefix = &name[..last_slash];
          if !prefix.contains('/') || prefix.chars().filter(|&c| c == '/').count() == 1 {
            return Ok(dir_path.to_string());
          }
        }
      }
    }

    Err(InstanceError::ModpackManifestParseError.into())
  }

  pub fn get_client_version(&self) -> SJMCLResult<String> {
    Ok(
      self
        .components
        .iter()
        .find(|component| component.uid == "net.minecraft")
        .ok_or(InstanceError::ModpackManifestParseError)?
        .version
        .clone(),
    )
  }

  pub fn get_mod_loader_type_version(&self) -> SJMCLResult<(ModLoaderType, String)> {
    for component in &self.components {
      match component.uid.as_str() {
        "net.minecraft" => continue,
        "net.minecraftforge" => return Ok((ModLoaderType::Forge, component.version.to_string())),
        "net.fabricmc.fabric-loader" => {
          return Ok((ModLoaderType::Fabric, component.version.to_string()))
        }
        "net.neoforged" => return Ok((ModLoaderType::NeoForge, component.version.to_string())),
        _ => return Err(InstanceError::UnsupportedModLoader.into()),
      }
    }
    Err(InstanceError::ModpackManifestParseError.into())
  }
}
