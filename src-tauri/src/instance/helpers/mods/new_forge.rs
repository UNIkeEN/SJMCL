// https://forge.gemwire.uk/wiki/Mods.toml
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::models::{ToTranslatableTable, TranslatableItem};
use crate::utils::image::image_to_base64;
use image::ImageReader;
use serde::{Deserialize, Serialize};
use std::io::{Cursor, Read, Seek};
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
  pub authors: Option<String>,
  pub description: Option<String>,
  pub logo_file: Option<String>,
}

impl ToTranslatableTable for NewforgeModMetadata {
  fn to_translatable_table(&self) -> Vec<(TranslatableItem, String)> {
    let mut table = vec![(TranslatableItem::License, self.license.clone())];
    if self.mods.len() > 0 {
      let ref mods = self.mods[0];
      if let Some(ref name) = mods.display_name {
        table.push((TranslatableItem::Name, name.clone()));
      }
      if let Some(ref version) = mods.version {
        table.push((TranslatableItem::Version, version.clone()));
      }
      if let Some(ref description) = mods.description {
        table.push((TranslatableItem::Description, description.clone()));
      }
      if let Some(ref authors) = mods.authors {
        table.push((TranslatableItem::Author, authors.clone()));
      }
      if let Some(ref credits) = mods.credits {
        table.push((TranslatableItem::Credits, credits.clone()));
      }
    }
    table
  }
}

pub fn load_newforge_from_jar<R: Read + Seek>(
  jar: &mut ZipArchive<R>,
) -> SJMCLResult<NewforgeModMetadata> {
  let mut meta: NewforgeModMetadata = match jar.by_name("META-INF/mods.toml") {
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
  Ok(meta)
}
