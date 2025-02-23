use crate::error::{SJMCLError, SJMCLResult};
use crate::utils::image::image_to_base64;
use image::ImageReader;
use std::fs;
use std::io::{Cursor, Read};
use std::path::PathBuf;
use zip::ZipArchive;

pub fn load_resourcepack_from_zip(path: &PathBuf) -> SJMCLResult<(String, Option<String>)> {
  let file = match fs::File::open(path) {
    Ok(val) => val,
    Err(e) => return Err(SJMCLError::from(e)),
  };
  let mut zip = match ZipArchive::new(file) {
    Ok(val) => val,
    Err(e) => return Err(SJMCLError::from(e)),
  };
  let mut description = String::new();
  let mut icon_src = None;

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

  if let Ok(mut file) = zip.by_name("pack.png") {
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;
    // Use `image` crate to decode the image
    let img = ImageReader::new(Cursor::new(buffer))
      .with_guessed_format()?
      .decode()?;
    if let Ok(b64) = image_to_base64(img.to_rgba8()) {
      icon_src = Some(b64);
    }
  }
  Ok((description, icon_src))
}

pub fn load_resourcepack_from_dir(path: &PathBuf) -> SJMCLResult<(String, Option<String>)> {
  let mut description = String::new();
  let mut icon_src = None;

  if let Ok(mut contents) = fs::read_to_string(path.join("pack.mcmeta")) {
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

  if let Ok(buffer) = fs::read(path.join("pack.png")) {
    // Use `image` crate to decode the image
    let img = ImageReader::new(Cursor::new(buffer))
      .with_guessed_format()?
      .decode()?;
    if let Ok(b64) = image_to_base64(img.to_rgba8()) {
      icon_src = Some(b64);
    }
  }
  Ok((description, icon_src))
}
