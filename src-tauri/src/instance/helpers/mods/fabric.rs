// see https://wiki.fabricmc.net/zh_cn:documentation:fabric_mod_json
use crate::error::{SJMCLError, SJMCLResult};
use crate::utils::image::image_to_base64;
use image::ImageReader;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{Cursor, Read, Seek};
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
  let mut meta: FabricModMetadata = match jar.by_name("fabric.mod.json") {
    Ok(val) => match serde_json::from_reader(val) {
      Ok(val) => val,
      Err(e) => return Err(SJMCLError::from(e)),
    },
    Err(e) => return Err(SJMCLError::from(e)),
  };
  if let Some(ref icon) = meta.icon {
    if let Ok(mut img_file) = jar.by_name(icon) {
      // Use `image` crate to decode the image
      let mut buffer = Vec::new();
      if img_file.read_to_end(&mut buffer).is_ok() {
        if let Ok(image_reader) = ImageReader::new(Cursor::new(buffer)).with_guessed_format() {
          if let Ok(img) = image_reader.decode() {
            if let Ok(b64) = image_to_base64(img.to_rgba8()) {
              meta.icon = Some(b64);
            }
          }
        }
      }
    }
  }
  Ok(meta)
}

pub async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<FabricModMetadata> {
  let fabric_file_path = dir_path.join("fabric.mod.json");
  let mut meta: FabricModMetadata = match tokio::fs::read_to_string(fabric_file_path).await {
    Ok(val) => match serde_json::from_str(val.as_str()) {
      Ok(val) => val,
      Err(e) => return Err(SJMCLError::from(e)),
    },
    Err(e) => return Err(SJMCLError::from(e)),
  };
  if let Some(ref icon) = meta.icon {
    let icon_file_path = dir_path.join(icon);
    if let Ok(buffer) = tokio::fs::read(icon_file_path).await {
      // Use `image` crate to decode the image
      if let Ok(image_reader) = ImageReader::new(Cursor::new(buffer)).with_guessed_format() {
        if let Ok(img) = image_reader.decode() {
          if let Ok(b64) = image_to_base64(img.to_rgba8()) {
            meta.icon = Some(b64);
          }
        }
      }
    }
  }
  Ok(meta)
}
