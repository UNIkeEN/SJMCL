// https://docs.neoforged.net/docs/gettingstarted/modfiles/#neoforgemodstoml

use crate::error::{SJMCLError, SJMCLResult};
use crate::utils::image::image_to_base64;
use image::ImageReader;
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
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct NeoforgeModSubItem {
  pub mod_id: String,
  pub namespace: Option<String>,
  pub version: Option<String>,
  pub display_name: Option<String>,
  pub description: Option<String>,
  pub logo_file: Option<String>,
  pub credits: Option<String>,
  pub display_url: Option<String>,
  pub authors: Option<Value>,
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
  let mods = &mut meta.mods[0];

  if let Some(ref logo_file) = mods.logo_file {
    if let Ok(mut img_file) = jar.by_name(logo_file) {
      // Use `image` crate to decode the image
      let mut buffer = Vec::new();
      if img_file.read_to_end(&mut buffer).is_ok() {
        if let Ok(image_reader) = ImageReader::new(Cursor::new(buffer)).with_guessed_format() {
          if let Ok(img) = image_reader.decode() {
            if let Ok(b64) = image_to_base64(img.to_rgba8()) {
              mods.logo_file = Some(b64);
            }
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
  let mods = &mut meta.mods[0];

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
  Ok(meta)
}
