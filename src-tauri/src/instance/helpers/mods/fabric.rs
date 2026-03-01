// see https://wiki.fabricmc.net/zh_cn:documentation:fabric_mod_json
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::helpers::mods::common::{compress_icon, LocalModMetadataParser};
use crate::instance::models::misc::{LocalModInfo, ModLoaderType};
use crate::utils::image::{load_image_from_dir_async, load_image_from_jar, ImageWrapper};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{Read, Seek};
use std::path::Path;
use tokio;
use zip::ZipArchive;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FabricModMetadata {
  pub id: String,
  pub version: String,
  pub name: Option<String>,
  pub description: Option<String>,
  pub icon: Option<String>,
  pub authors: Option<Value>,
  pub contact: Option<HashMap<String, String>>,
}

impl From<FabricModMetadata> for LocalModInfo {
  fn from(meta: FabricModMetadata) -> Self {
    Self {
      name: meta.name.unwrap_or_default(),
      version: meta.version,
      description: meta.description.unwrap_or_default(),
      loader_type: ModLoaderType::Fabric,
      ..Default::default()
    }
  }
}

#[derive(Clone, Copy)]
pub struct FabricModMetadataParser;

#[async_trait]
impl LocalModMetadataParser for FabricModMetadataParser {
  type Metadata = FabricModMetadata;

  fn get_mod_metadata_from_jar<R: Read + Seek>(
    jar: &mut ZipArchive<R>,
  ) -> SJMCLResult<Self::Metadata> {
    let meta: FabricModMetadata = match jar.by_name("fabric.mod.json") {
      Ok(val) => match serde_json::from_reader(val) {
        Ok(val) => val,
        Err(e) => return Err(SJMCLError::from(e)),
      },
      Err(e) => return Err(SJMCLError::from(e)),
    };
    Ok(meta)
  }

  async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<Self::Metadata> {
    let fabric_file_path = dir_path.join("fabric.mod.json");
    let meta: FabricModMetadata = match tokio::fs::read_to_string(fabric_file_path).await {
      Ok(val) => match serde_json::from_str(val.as_str()) {
        Ok(val) => val,
        Err(e) => return Err(SJMCLError::from(e)),
      },
      Err(e) => return Err(SJMCLError::from(e)),
    };
    Ok(meta)
  }

  fn get_icon_from_jar<R: Read + Seek>(
    meta: &mut Self::Metadata,
    jar: &mut ZipArchive<R>,
  ) -> ImageWrapper {
    if let Some(icon) = meta.icon.as_deref() {
      return load_image_from_jar(jar, icon)
        .map(ImageWrapper::from)
        .map(compress_icon)
        .unwrap_or_default();
    }
    ImageWrapper::default()
  }

  async fn get_icon_from_dir(meta: &mut Self::Metadata, dir_path: &Path) -> ImageWrapper {
    if let Some(icon) = meta.icon.as_deref() {
      return load_image_from_dir_async(&dir_path.join(icon))
        .await
        .map(ImageWrapper::from)
        .map(compress_icon)
        .unwrap_or_default();
    }
    ImageWrapper::default()
  }
}
