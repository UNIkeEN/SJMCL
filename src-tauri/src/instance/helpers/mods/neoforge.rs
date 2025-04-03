// https://docs.neoforged.net/docs/gettingstarted/modfiles/#neoforgemodstoml

use crate::error::{SJMCLError, SJMCLResult};
use crate::utils::image::{load_image_base64_from_dir, load_image_base64_from_jar};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Cursor, Read, Seek};
use std::path::Path;
use tokio;
use toml;
use zip::ZipArchive;

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct NeoforgeModMetadata {
  pub mod_loader: String,
  pub loader_version: String,
  pub license: String,
  pub mods: Vec<NeoforgeModSubItem>,
  // used for base64 result.
  pub logo_file: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct NeoforgeModSubItem {
  pub mod_id: String,
  pub namespace: Option<String>,
  pub version: Option<String>,
  pub display_name: Option<String>,
  pub display_url: Option<String>,
  pub credits: Option<String>,
  pub authors: Option<Value>,
  pub description: Option<String>,
  pub logo_file: Option<String>,
}

pub fn get_mod_metadata_from_jar<R: Read + Seek>(
  jar: &mut ZipArchive<R>,
) -> SJMCLResult<NeoforgeModMetadata> {
  let mut meta: NeoforgeModMetadata = match jar.by_name("META-INF/neoforge.mods.toml") {
    Ok(mut val) => {
      let mut buf = String::new();
      if let Err(e) = val.read_to_string(&mut buf) {
        return Err(SJMCLError::from(e));
      }
      match toml::from_str(&buf) {
        Ok(meta) => meta,
        Err(e) => return Err(SJMCLError::from(e)),
      }
    }
    Err(e) => return Err(SJMCLError::from(e)),
  };
  if meta.mods.is_empty() {
    return Err(SJMCLError("neoforge mod len(mods) == 0".to_string()));
  }
  // seek logo (in standard implementation, logo field should in mods[0], but some mod's logo field is in toml meta. TODO: try serde flatten?)
  let mut logo_candidates = vec![];
  if let Some(path) = &meta.logo_file {
    logo_candidates.push(path.clone());
  }
  for m in &meta.mods {
    if let Some(path) = &m.logo_file {
      logo_candidates.push(path.clone());
    }
  }
  for path in logo_candidates {
    if let Some(b64) = load_image_base64_from_jar(jar, &path) {
      meta.logo_file = Some(b64);
      break;
    }
  }
  // fallback to get version
  if let Some(ref mut version) = meta.mods[0].version {
    if version == "${file.jarVersion}" {
      if let Ok(mf_file) = jar.by_name("META-INF/MANIFEST.MF") {
        if let Ok(mf) = java_properties::read(mf_file) {
          if let Some(jar_version) = mf.get("Implementation-Version") {
            *version = jar_version.clone();
          }
        }
      }
    }
  }
  Ok(meta)
}

pub async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<NeoforgeModMetadata> {
  let neoforge_file_path = dir_path.join("META-INF/neoforge.mods.toml");
  let mut meta: NeoforgeModMetadata = match tokio::fs::read_to_string(neoforge_file_path).await {
    Ok(val) => match serde_json::from_str(val.as_str()) {
      Ok(val) => val,
      Err(e) => return Err(SJMCLError::from(e)),
    },
    Err(e) => return Err(SJMCLError::from(e)),
  };
  if meta.mods.is_empty() {
    return Err(SJMCLError("neoforge mod len(mods) == 0".to_string()));
  }
  // seek logo
  let mut logo_candidates = vec![];
  if let Some(path) = &meta.logo_file {
    logo_candidates.push(dir_path.join(path));
  }
  for m in &meta.mods {
    if let Some(path) = &m.logo_file {
      logo_candidates.push(dir_path.join(path));
    }
  }
  for path in logo_candidates {
    if let Some(b64) = load_image_base64_from_dir(&path).await {
      meta.logo_file = Some(b64);
      break;
    }
  }
  // fallback to get version
  if let Some(ref mut version) = meta.mods[0].version {
    if version == "${file.jarVersion}" {
      if let Ok(mf_string) = tokio::fs::read_to_string(dir_path.join("META-INF/MANIFEST.MF")).await
      {
        if let Ok(mf) = java_properties::read(Cursor::new(mf_string)) {
          if let Some(jar_version) = mf.get("Implementation-Version") {
            *version = jar_version.clone();
          }
        }
      }
    }
  }
  Ok(meta)
}
