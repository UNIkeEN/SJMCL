// https://forge.gemwire.uk/wiki/Mods.toml
use crate::error::{SJMCLError, SJMCLResult};
use crate::utils::image::image_to_base64;
use image::ImageReader;
use java_properties;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Cursor, Read, Seek};
use std::path::PathBuf;
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

pub fn load_newforge_from_jar<R: Read + Seek>(
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
      if let Ok(_) = jar.by_name("META-INF/MANIFEST.MF") {
        return Ok(NewforgeModMetadata {
          mod_loader: format!("javafml"),
          loader_version: String::new(),
          license: String::new(),
          mods: vec![NewforgeModSubItem::default()],
        });
      } else {
        return Err(e);
      }
    }
  };
  if meta.mods.is_empty() {
    return Err(SJMCLError("new forge mod len(mods) == 0".to_string()));
  }
  if let Some(ref logo_file) = meta.mods[0].logo_file {
    if let Ok(mut img_file) = jar.by_name(&logo_file) {
      // Use `image` crate to decode the image
      let mut buffer = Vec::new();
      if img_file.read_to_end(&mut buffer).is_ok() {
        if let Ok(image_reader) = ImageReader::new(Cursor::new(buffer)).with_guessed_format() {
          if let Ok(img) = image_reader.decode() {
            if let Ok(b64) = image_to_base64(img.to_rgba8()) {
              meta.mods[0].logo_file = Some(b64);
            }
          }
        }
      }
    }
  }
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

pub async fn load_newforge_from_dir(dir_path: &PathBuf) -> SJMCLResult<NewforgeModMetadata> {
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
  let ref mut mods = meta.mods[0];

  if let Some(ref logo_file) = mods.logo_file {
    if let Ok(buffer) = tokio::fs::read(&logo_file).await {
      if let Ok(image_reader) = ImageReader::new(Cursor::new(buffer)).with_guessed_format() {
        if let Ok(img) = image_reader.decode() {
          if let Ok(b64) = image_to_base64(img.to_rgba8()) {
            mods.logo_file = Some(b64);
          }
        }
      }
    }
  }
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
