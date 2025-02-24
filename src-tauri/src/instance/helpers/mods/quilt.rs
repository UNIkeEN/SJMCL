// https://github.com/QuiltMC/rfcs/blob/main/specification/0002-quilt.mod.json.md
use crate::error::{SJMCLError, SJMCLResult};
use crate::utils::image::image_to_base64;
use image::ImageReader;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Cursor, Read, Seek};
use std::path::PathBuf;
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

pub fn load_quiltmod_from_jar<R: Read + Seek>(jar: &mut ZipArchive<R>) -> SJMCLResult<QuiltLoader> {
  let mut meta: QuiltLoader = match jar.by_name("quilt.mod.json") {
    Ok(val) => match serde_json::from_reader(val) {
      Ok(val) => val,
      Err(e) => return Err(SJMCLError::from(e)),
    },
    Err(e) => return Err(SJMCLError::from(e)),
  };
  if let Some(ref mut icon) = meta.metadata.icon {
    if let Ok(mut img_file) = jar.by_name(&icon) {
      // Use `image` crate to decode the image
      let mut buffer = Vec::new();
      if img_file.read_to_end(&mut buffer).is_ok() {
        if let Ok(image_reader) = ImageReader::new(Cursor::new(buffer)).with_guessed_format() {
          if let Ok(img) = image_reader.decode() {
            if let Ok(b64) = image_to_base64(img.to_rgba8()) {
              *icon = b64;
            }
          }
        }
      }
    }
  }
  Ok(meta)
}

pub async fn load_quiltmod_from_dir(dir_path: &PathBuf) -> SJMCLResult<QuiltLoader> {
  let quilt_file_path = dir_path.join("quilt.mod.json");
  let content = tokio::fs::read_to_string(quilt_file_path).await?;
  let mut meta: QuiltLoader = serde_json::from_str(&content)?;
  if let Some(ref mut logo_file) = meta.metadata.icon {
    if let Ok(buffer) = tokio::fs::read(&logo_file).await {
      if let Ok(image_reader) = ImageReader::new(Cursor::new(buffer)).with_guessed_format() {
        if let Ok(img) = image_reader.decode() {
          if let Ok(b64) = image_to_base64(img.to_rgba8()) {
            *logo_file = b64;
          }
        }
      }
    }
  }
  Ok(meta)
}
