// https://zh.minecraft.wiki/w/%E7%89%88%E6%9C%AC%E4%BF%A1%E6%81%AF%E6%96%87%E4%BB%B6%E6%A0%BC%E5%BC%8F

use crate::error::{SJMCLError, SJMCLResult};
use crate::utils::image::image_to_base64;
use image::ImageReader;
use serde::{Deserialize, Serialize};
use std::io::{Cursor, Read, Seek};
use zip::ZipArchive;

#[derive(Debug, Deserialize, Serialize, Default)]
pub struct GameVersionData {
  pub build_time: String, // y
  pub id: String,         // y "1.14 / 5dac5567e13e46bdb0c1d90aa8d8b3f7"
  pub java_component: Option<String>,
  pub java_version: Option<i64>,
  pub name: String,                    // y
  pub pack_version: serde_json::Value, // Union int or (int, int)
  pub protocol_version: i64,           // y
  pub series_id: Option<String>,
  pub stable: bool,       // y
  pub world_version: i64, // y
  pub use_editor: Option<bool>,
}

pub fn load_game_version_from_jar<R: Read + Seek>(
  jar: &mut ZipArchive<R>,
) -> SJMCLResult<GameVersionData> {
  let meta: GameVersionData = match jar.by_name("version.json") {
    Ok(val) => match serde_json::from_reader(val) {
      Ok(val) => val,
      Err(e) => return Err(SJMCLError::from(e)),
    },
    Err(e) => return Err(SJMCLError::from(e)),
  };
  Ok(meta)
}

pub fn load_image_from_jar<R: Read + Seek>(jar: &mut ZipArchive<R>) -> SJMCLResult<String> {
  if let Ok(mut file) = jar.by_name("pack.png") {
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;
    // Use `image` crate to decode the image
    let img = ImageReader::new(Cursor::new(buffer))
      .with_guessed_format()?
      .decode()?;
    if let Ok(b64) = image_to_base64(img.to_rgba8()) {
      return Ok(b64);
    }
  }
  Err(SJMCLError("pack.png not found in jar".to_string()))
}
