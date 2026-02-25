// https://github.com/QuiltMC/rfcs/blob/main/specification/0002-quilt.mod.json.md
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

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(default)]
pub struct QuiltModMetadata {
  pub schema_version: i32,
  pub quilt_loader: QuiltLoader,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(default)]
pub struct QuiltLoader {
  pub group: String,
  pub id: String,
  pub version: String,
  pub metadata: QuiltLoaderMetadata,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(default)]
pub struct QuiltLoaderMetadata {
  pub name: Option<String>,
  pub description: Option<String>,
  pub contributors: Option<Value>,
  pub icon: Option<String>,
  pub contact: Option<Value>,
}

impl From<QuiltLoader> for LocalModInfo {
  fn from(meta: QuiltLoader) -> Self {
    Self {
      name: meta.metadata.name.unwrap_or_default(),
      version: meta.version,
      description: meta.metadata.description.unwrap_or_default(),
      loader_type: ModLoaderType::Quilt,
      ..Default::default()
    }
  }
}

#[derive(Clone, Copy)]
pub struct QuiltModMetadataParser;

#[async_trait]
impl LocalModMetadataParser for QuiltModMetadataParser {
  type Metadata = QuiltLoader;

  fn get_mod_metadata_from_jar<R: Read + Seek>(
    jar: &mut ZipArchive<R>,
  ) -> SJMCLResult<Self::Metadata> {
    let meta: QuiltLoader = match jar.by_name("quilt.mod.json") {
      Ok(val) => match serde_json::from_reader(val) {
        Ok(val) => val,
        Err(e) => return Err(SJMCLError::from(e)),
      },
      Err(e) => return Err(SJMCLError::from(e)),
    };
    Ok(meta)
  }

  async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<Self::Metadata> {
    let quilt_file_path = dir_path.join("quilt.mod.json");
    let content = tokio::fs::read_to_string(quilt_file_path).await?;
    let meta: QuiltLoader = serde_json::from_str(&content)?;
    Ok(meta)
  }

  fn wrap_icon_from_jar<R: Read + Seek>(
    meta: &mut Self::Metadata,
    jar: &mut ZipArchive<R>,
  ) -> ImageWrapper {
    if let Some(icon) = meta.metadata.icon.as_deref() {
      return load_image_from_jar(jar, icon)
        .map(ImageWrapper::from)
        .map(compress_icon)
        .unwrap_or_default();
    }
    ImageWrapper::default()
  }

  async fn wrap_icon_from_dir(meta: &mut Self::Metadata, dir_path: &Path) -> ImageWrapper {
    if let Some(icon) = meta.metadata.icon.as_deref() {
      return load_image_from_dir_async(&dir_path.join(icon))
        .await
        .map(ImageWrapper::from)
        .map(compress_icon)
        .unwrap_or_default();
    }
    ImageWrapper::default()
  }
}
