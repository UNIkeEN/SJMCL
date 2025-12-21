use crate::error::SJMCLResult;
use crate::instance::helpers::modpack::misc::{ModpackManifest, ModpackMetaInfo};
use crate::instance::models::misc::{InstanceError, ModLoader, ModLoaderType};
use crate::resource::models::OtherResourceSource;
use crate::tasks::PTaskParam;
use async_trait::async_trait;
use config::Config;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use tauri::AppHandle;
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
  pub cached_volatile: Option<bool>,
  pub important: Option<bool>,
  pub dependency_only: Option<bool>,
  pub uid: String,
  pub version: Option<String>,
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

#[async_trait]
impl ModpackManifest for MultiMcManifest {
  fn from_archive(file: &File) -> SJMCLResult<Self> {
    let mut archive = ZipArchive::new(file)?;

    let base_path = if archive.by_name("mmc-pack.json").is_ok() {
      String::new()
    } else {
      let mut found_path = None;
      for i in 0..archive.len() {
        let file = archive.by_index(i)?;
        let name = file.name();

        if name.ends_with("mmc-pack.json") {
          if let Some(last_slash) = name.rfind('/') {
            let dir_path = &name[..=last_slash];
            let depth = name[..last_slash].matches('/').count();
            if depth <= 1 {
              found_path = Some(dir_path.to_string());
              break;
            }
          }
        }
      }
      found_path.ok_or(InstanceError::ModpackManifestParseError)?
    };

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

  async fn get_meta_info(&self, app: &AppHandle) -> SJMCLResult<ModpackMetaInfo> {
    let client_version = self.get_client_version()?;
    let mod_loader = if let Ok((loader_type, version)) = self.get_mod_loader_type_version() {
      Some(
        ModLoader {
          loader_type,
          version,
          ..Default::default()
        }
        .with_branch(app, client_version.clone())
        .await?,
      )
    } else {
      None
    };
    Ok(ModpackMetaInfo {
      name: self.cfg.get("name").cloned().unwrap_or_default(),
      version: String::new(),
      description: None,
      author: None,
      modpack_source: OtherResourceSource::MultiMc,
      client_version,
      mod_loader,
    })
  }

  fn get_client_version(&self) -> SJMCLResult<String> {
    let component = self
      .components
      .iter()
      .find(|component| component.uid == "net.minecraft")
      .ok_or(InstanceError::ModpackManifestParseError)?;

    get_version(component)
  }

  fn get_mod_loader_type_version(&self) -> SJMCLResult<(ModLoaderType, String)> {
    for component in &self.components {
      match component.uid.as_str() {
        "net.minecraft" => continue,
        "net.minecraftforge" => return Ok((ModLoaderType::Forge, get_version(component)?)),
        "net.fabricmc.fabric-loader" => {
          return Ok((ModLoaderType::Fabric, get_version(component)?))
        }
        "net.neoforged" => return Ok((ModLoaderType::NeoForge, get_version(component)?)),
        _ => continue,
      }
    }
    Err(InstanceError::ModpackManifestParseError.into())
  }

  async fn get_download_params(
    &self,
    _app: &AppHandle,
    _instance_path: &Path,
  ) -> SJMCLResult<Vec<PTaskParam>> {
    // MultiMC Manifests do not include download parameters
    Ok(Vec::new())
  }

  fn get_overrides_path(&self) -> String {
    format!("{}.minecraft/", self.base_path)
  }
}

fn get_version(component: &MultiMcComponent) -> SJMCLResult<String> {
  component
    .version
    .as_ref()
    .or(component.cached_version.as_ref())
    .cloned()
    .ok_or(InstanceError::ModpackManifestParseError.into())
}
