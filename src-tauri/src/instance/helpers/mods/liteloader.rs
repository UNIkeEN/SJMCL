// https://www.mcmod.cn/class/610.html
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::helpers::mods::common::LocalModMetadataParser;
use crate::instance::models::misc::{LocalModInfo, ModLoaderType};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Read, Seek};
use std::path::Path;
use tokio;
use zip::ZipArchive;

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct LiteloaderModMetadata {
  pub name: Option<String>,
  pub version: Option<String>,
  pub mcversion: Option<String>,
  pub revision: Option<String>,
  pub author: Option<Value>,
  pub class_transformer_classes: Vec<String>,
  pub description: Option<String>,
  pub modpack_name: Option<String>,
  pub modpack_version: Option<String>,
  pub check_update_url: Option<String>,
  pub update_uri: Option<String>,
}

impl From<LiteloaderModMetadata> for LocalModInfo {
  fn from(meta: LiteloaderModMetadata) -> Self {
    Self {
      name: meta.name.unwrap_or_default(),
      version: meta.version.unwrap_or_default(),
      description: meta.description.unwrap_or_default(),
      loader_type: ModLoaderType::LiteLoader,
      ..Default::default()
    }
  }
}

#[derive(Clone, Copy)]
pub struct LiteLoaderModMetadataParser;

#[async_trait]
impl LocalModMetadataParser for LiteLoaderModMetadataParser {
  type Metadata = LiteloaderModMetadata;

  fn get_mod_metadata_from_jar<R: Read + Seek>(
    jar: &mut ZipArchive<R>,
  ) -> SJMCLResult<Self::Metadata> {
    let meta: LiteloaderModMetadata = match jar.by_name("litemod.json") {
      Ok(val) => match serde_json::from_reader(val) {
        Ok(val) => val,
        Err(e) => return Err(SJMCLError::from(e)),
      },
      Err(e) => return Err(SJMCLError::from(e)),
    };
    Ok(meta)
  }

  async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<Self::Metadata> {
    let liteloader_file_path = dir_path.join("litemod.json");
    let meta: LiteloaderModMetadata = serde_json::from_str(
      tokio::fs::read_to_string(liteloader_file_path)
        .await?
        .as_str(),
    )?;
    Ok(meta)
  }
}
