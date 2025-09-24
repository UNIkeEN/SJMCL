// see https://wiki.fabricmc.net/zh_cn:documentation:fabric_mod_json
use crate::error::{SJMCLError, SJMCLResult};
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

pub fn get_mod_metadata_from_jar<R: Read + Seek>(
  jar: &mut ZipArchive<R>,
) -> SJMCLResult<FabricModMetadata> {
  let meta: FabricModMetadata = match jar.by_name("fabric.mod.json") {
    Ok(val) => match serde_json::from_reader(val) {
      Ok(val) => val,
      Err(e) => return Err(SJMCLError::from(e)),
    },
    Err(e) => return Err(SJMCLError::from(e)),
  };
  Ok(meta)
}

pub async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<FabricModMetadata> {
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
