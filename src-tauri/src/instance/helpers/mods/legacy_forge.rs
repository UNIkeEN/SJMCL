// https://mc1122modtutorialdocs-sphinx.readthedocs.io/zh-cn/latest/mainclass/01_mcmodinfo.html
use crate::error::{SJMCLError, SJMCLResult};
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

pub fn get_mod_metadata_from_jar<R: Read + Seek>(
  jar: &mut ZipArchive<R>,
) -> SJMCLResult<LegacyForgeModMetadata> {
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

pub async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<LegacyForgeModMetadata> {
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
