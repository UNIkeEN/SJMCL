use crate::error::{SJMCLError, SJMCLResult};
use crate::utils::image::{load_image_from_dir_async, load_image_from_jar};
use image::RgbaImage;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use zip::ZipArchive;

pub fn load_resourcepack_from_zip(path: &PathBuf) -> SJMCLResult<(String, Option<RgbaImage>)> {
  let file = match fs::File::open(path) {
    Ok(val) => val,
    Err(e) => return Err(SJMCLError::from(e)),
  };
  let mut zip = match ZipArchive::new(file) {
    Ok(val) => val,
    Err(e) => return Err(SJMCLError::from(e)),
  };
  let mut description = String::new();

  if let Ok(mut file) = zip.by_name("pack.mcmeta") {
    let mut contents = String::new();
    if let Err(e) = file.read_to_string(&mut contents) {
      return Err(SJMCLError::from(e));
    } else {
      // Check for and remove the UTF-8 BOM if present
      if contents.starts_with('\u{FEFF}') {
        contents = contents.strip_prefix('\u{FEFF}').unwrap().to_string();
      }
      match serde_json::from_str::<serde_json::Value>(&contents) {
        Ok(json_result) => {
          // Safely extract `description`
          if let Some(pack_data) = json_result.get("pack") {
            if let Some(desc) = pack_data.get("description") {
              // Assume `desc` is a valid JSON object or primitive
              if let Some(desc_str) = desc.as_str() {
                description = desc_str.to_string();
              }
            }
          }
        }
        Err(e) => {
          return Err(SJMCLError::from(e));
        }
      }
    }
  } else {
    return Err(SJMCLError(format!(
      "pack.mcmeta not found in zip file '{}'",
      path.to_str().unwrap_or("")
    )));
  }

  let icon_src = load_image_from_jar(&mut zip, "pack.png");
  Ok((description, icon_src))
}

pub async fn load_resourcepack_from_dir(path: &Path) -> SJMCLResult<(String, Option<RgbaImage>)> {
  let mut description = String::new();

  if let Ok(mut contents) = tokio::fs::read_to_string(path.join("pack.mcmeta")).await {
    // Check for and remove the UTF-8 BOM if present
    if contents.starts_with('\u{FEFF}') {
      contents = contents.strip_prefix('\u{FEFF}').unwrap().to_string();
    }
    match serde_json::from_str::<serde_json::Value>(&contents) {
      Ok(json_result) => {
        // Safely extract `description`
        if let Some(pack_data) = json_result.get("pack") {
          if let Some(desc) = pack_data.get("description") {
            // Assume `desc` is a valid JSON object or primitive
            if let Some(desc_str) = desc.as_str() {
              description = desc_str.to_string();
            }
          }
        }
      }
      Err(e) => {
        return Err(SJMCLError::from(e));
      }
    }
  } else {
    return Err(SJMCLError("pack.mcmeta not found in ''".to_string()));
  }

  let icon_src = load_image_from_dir_async(&path.join("pack.png")).await;
  Ok((description, icon_src))
}
