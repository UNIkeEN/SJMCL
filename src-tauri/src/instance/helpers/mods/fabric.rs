// see https://wiki.fabricmc.net/zh_cn:documentation:fabric_mod_json

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::collections::HashMap;
use std::io::{Read, Seek};
use std::path::Path;
use tokio;
use zip::ZipArchive;

use crate::instance::helpers::mods::common::{
  LocalModMetadataParser, compress_icon, sanitize_lenient_json,
};
use crate::instance::models::misc::{LocalModInfo, ModLoaderType};
use crate::utils::image::{ImageWrapper, load_image_from_dir_async, load_image_from_jar};

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
    use std::io::Read as _;

    let mut content = String::new();
    match jar.by_name("fabric.mod.json") {
      Ok(mut val) => {
        val.read_to_string(&mut content)?;
      }
      Err(e) => return Err(SJMCLError::from(e)),
    }
    let meta: FabricModMetadata = match serde_json::from_str(&content) {
      Ok(val) => val,
      Err(_) => serde_json::from_str(&sanitize_lenient_json(&content))?,
    };
    Ok(meta)
  }

  async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<Self::Metadata> {
    let fabric_file_path = dir_path.join("fabric.mod.json");
    let content = tokio::fs::read_to_string(fabric_file_path).await?;
    let meta: FabricModMetadata = match serde_json::from_str(content.as_str()) {
      Ok(val) => val,
      Err(_) => serde_json::from_str(&sanitize_lenient_json(&content))?,
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

#[cfg(test)]
mod tests {
  use super::*;
  use crate::instance::helpers::mods::common::sanitize_lenient_json;

  fn parse(raw: &str) -> serde_json::Result<FabricModMetadata> {
    match serde_json::from_str::<FabricModMetadata>(raw) {
      Ok(v) => Ok(v),
      Err(_) => serde_json::from_str::<FabricModMetadata>(&sanitize_lenient_json(raw)),
    }
  }

  #[test]
  fn parses_wellformed_metadata() {
    let raw = r#"{"id":"foo","version":"1.0.0","name":"Foo","description":"a mod"}"#;
    let meta = parse(raw).unwrap();
    assert_eq!(meta.id, "foo");
    assert_eq!(meta.version, "1.0.0");
    assert_eq!(meta.name.as_deref(), Some("Foo"));
  }

  #[test]
  fn tolerates_raw_newline_in_description() {
    // BetterGrassify-style metadata: a raw newline inside the description string.
    let raw = "{\"id\":\"bettergrassify\",\"version\":\"1.2.3\",\"name\":\"BetterGrassify\",\"description\":\"line one\nline two\"}";
    assert!(serde_json::from_str::<FabricModMetadata>(raw).is_err());
    let meta = parse(raw).unwrap();
    assert_eq!(meta.id, "bettergrassify");
    assert_eq!(meta.version, "1.2.3");
    assert_eq!(meta.name.as_deref(), Some("BetterGrassify"));
    assert_eq!(meta.description.as_deref(), Some("line one\nline two"));
  }

  #[test]
  fn tolerates_raw_tab_in_string() {
    let raw = "{\"id\":\"baz\",\"version\":\"0.1\",\"description\":\"col1\tcol2\"}";
    let meta = parse(raw).unwrap();
    assert_eq!(meta.id, "baz");
    assert_eq!(meta.description.as_deref(), Some("col1\tcol2"));
  }

  #[test]
  fn genuinely_broken_json_still_fails() {
    // Missing required `version`, and truncated braces -> must still error.
    let raw = "{\"id\":\"foo\",\"name\":\"Foo\"";
    assert!(parse(raw).is_err());
  }
}
