// https://www.mcmod.cn/class/610.html
use crate::error::{SJMCLError, SJMCLResult};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Read, Seek};
use std::path::PathBuf;
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

pub fn load_liteloader_from_jar<R: Read + Seek>(
  jar: &mut ZipArchive<R>,
) -> SJMCLResult<LiteloaderModMetadata> {
  let meta: LiteloaderModMetadata = match jar.by_name("litemod.json") {
    Ok(val) => match serde_json::from_reader(val) {
      Ok(val) => val,
      Err(e) => return Err(SJMCLError::from(e)),
    },
    Err(e) => return Err(SJMCLError::from(e)),
  };
  Ok(meta)
}

pub async fn load_liteloader_from_dir(dir_path: &PathBuf) -> SJMCLResult<LiteloaderModMetadata> {
  let liteloader_file_path = dir_path.join("litemod.json");
  let meta: LiteloaderModMetadata = serde_json::from_str(
    tokio::fs::read_to_string(liteloader_file_path)
      .await?
      .as_str(),
  )?;
  Ok(meta)
}
