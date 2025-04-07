// https://forge.gemwire.uk/wiki/Mods.toml
use crate::error::{SJMCLError, SJMCLResult};
use crate::utils::image::{load_image_from_dir_async, load_image_from_jar, ImageWrapper};
use java_properties;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Cursor, Read, Seek};
use std::path::Path;
use tokio;
use toml;
use zip::ZipArchive;

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct NewforgeModMetadata {
  pub mod_loader: String,
  pub loader_version: String,
  pub license: String,
  pub mods: Vec<NewforgeModSubItem>,
  // some non-standard mods write logo_file field in toml meta section.
  pub logo_file: Option<String>,
  // not in file, added by sjmcl
  pub valid_logo_file: Option<ImageWrapper>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct NewforgeModSubItem {
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
) -> SJMCLResult<NewforgeModMetadata> {
  let meta = match jar.by_name("META-INF/mods.toml") {
    Ok(mut val) => {
      let mut buf = String::new();
      if let Err(e) = val.read_to_string(&mut buf) {
        return Err(SJMCLError::from(e));
      }
      Ok(toml::from_str::<NewforgeModMetadata>(&buf)?)
    }
    Err(e) => Err(SJMCLError::from(e)),
  };
  let mut meta = match meta {
    Ok(val) => val,
    Err(e) => {
      if jar.by_name("META-INF/MANIFEST.MF").is_ok() {
        return Ok(NewforgeModMetadata {
          mod_loader: "javafml".to_string(),
          loader_version: String::new(),
          license: String::new(),
          mods: vec![NewforgeModSubItem::default()],
          logo_file: None,
          valid_logo_file: None,
        });
      } else {
        return Err(e);
      }
    }
  };
  if meta.mods.is_empty() {
    return Err(SJMCLError("new forge mod len(mods) == 0".to_string()));
  }
  // seek logo
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
    if let Some(img) = load_image_from_jar(jar, &path) {
      meta.valid_logo_file = Some(img.into());
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

pub async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<NewforgeModMetadata> {
  let newforge_file_path = dir_path.join("META-INF/mods.toml");
  let mut meta: NewforgeModMetadata = match tokio::fs::read_to_string(newforge_file_path).await {
    Ok(val) => match serde_json::from_str(val.as_str()) {
      Ok(val) => val,
      Err(e) => return Err(SJMCLError::from(e)),
    },
    Err(e) => return Err(SJMCLError::from(e)),
  };
  if meta.mods.is_empty() {
    return Err(SJMCLError("newforge mod len(mods) == 0".to_string()));
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
    if let Some(img) = load_image_from_dir_async(&path).await {
      meta.valid_logo_file = Some(img.into());
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
