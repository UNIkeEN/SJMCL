// https://github.com/QuiltMC/rfcs/blob/main/specification/0002-quilt.mod.json.md
use crate::error::{SJMCLError, SJMCLResult};
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

pub fn get_mod_metadata_from_jar<R: Read + Seek>(
  jar: &mut ZipArchive<R>,
) -> SJMCLResult<QuiltLoader> {
  let meta: QuiltLoader = match jar.by_name("quilt.mod.json") {
    Ok(val) => match serde_json::from_reader(val) {
      Ok(val) => val,
      Err(e) => return Err(SJMCLError::from(e)),
    },
    Err(e) => return Err(SJMCLError::from(e)),
  };
  Ok(meta)
}

pub async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<QuiltLoader> {
  let quilt_file_path = dir_path.join("quilt.mod.json");
  let content = tokio::fs::read_to_string(quilt_file_path).await?;
  let meta: QuiltLoader = serde_json::from_str(&content)?;
  Ok(meta)
}
