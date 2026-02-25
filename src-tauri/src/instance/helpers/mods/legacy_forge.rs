// https://mc1122modtutorialdocs-sphinx.readthedocs.io/zh-cn/latest/mainclass/01_mcmodinfo.html
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::helpers::mods::common::{compress_icon, LocalModMetadataParser};
use crate::instance::models::misc::{LocalModInfo, ModLoaderType};
use crate::utils::image::{load_image_from_dir_async, load_image_from_jar, ImageWrapper};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Read, Seek};
use std::path::Path;
use tokio;
use zip::ZipArchive;

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct LegacyForgeModMetadata {
  pub modid: String,
  pub name: Option<String>,
  pub description: Option<String>,
  pub version: Option<String>,
  pub logo_file: Option<String>,
  pub mcversion: Option<String>,
  pub url: Option<String>,
  pub update_url: Option<String>,
  pub credits: Option<String>,
  pub author_list: Option<Vec<Value>>,
}

impl From<LegacyForgeModMetadata> for LocalModInfo {
  fn from(meta: LegacyForgeModMetadata) -> Self {
    Self {
      name: meta.name.unwrap_or_default(),
      version: meta.version.unwrap_or_default(),
      description: meta.description.unwrap_or_default(),
      loader_type: ModLoaderType::Forge,
      ..Default::default()
    }
  }
}

#[derive(Clone, Copy)]
pub struct LegacyForgeModMetadataParser;

#[async_trait]
impl LocalModMetadataParser for LegacyForgeModMetadataParser {
  type Metadata = LegacyForgeModMetadata;

  fn get_mod_metadata_from_jar<R: Read + Seek>(
    jar: &mut ZipArchive<R>,
  ) -> SJMCLResult<Self::Metadata> {
    let mut meta: Vec<LegacyForgeModMetadata> = match jar.by_name("mcmod.info") {
      Ok(val) => match serde_json::from_reader(val) {
        Ok(val) => val,
        Err(e) => return Err(SJMCLError::from(e)),
      },
      Err(e) => return Err(SJMCLError::from(e)),
    };
    if meta.is_empty() {
      return Err(SJMCLError("len of LegacyForgeModMetadata is 0".to_string()));
    }
    Ok(meta.remove(0))
  }

  async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<Self::Metadata> {
    let legacy_forge_file_path = dir_path.join("mcmod.info");
    let mut meta: Vec<LegacyForgeModMetadata> =
      match tokio::fs::read_to_string(legacy_forge_file_path).await {
        Ok(val) => match serde_json::from_str(val.as_str()) {
          Ok(val) => val,
          Err(e) => return Err(SJMCLError::from(e)),
        },
        Err(e) => return Err(SJMCLError::from(e)),
      };
    if meta.is_empty() {
      return Err(SJMCLError("len of LegacyForgeModMetadata is 0".to_string()));
    }
    Ok(meta.remove(0))
  }

  fn wrap_icon_from_jar<R: Read + Seek>(
    meta: &mut Self::Metadata,
    jar: &mut ZipArchive<R>,
  ) -> ImageWrapper {
    if let Some(icon) = meta.logo_file.as_deref() {
      return load_image_from_jar(jar, icon)
        .map(ImageWrapper::from)
        .map(compress_icon)
        .unwrap_or_default();
    }
    ImageWrapper::default()
  }

  async fn wrap_icon_from_dir(meta: &mut Self::Metadata, dir_path: &Path) -> ImageWrapper {
    if let Some(icon) = meta.logo_file.as_deref() {
      return load_image_from_dir_async(&dir_path.join(icon))
        .await
        .map(ImageWrapper::from)
        .map(compress_icon)
        .unwrap_or_default();
    }
    ImageWrapper::default()
  }
}
