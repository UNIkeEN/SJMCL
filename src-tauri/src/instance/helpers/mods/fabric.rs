// see https://wiki.fabricmc.net/zh_cn:documentation:fabric_mod_json
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::models::{ToTranslatableTable, TranslatableItem};
use crate::utils::image::image_to_base64;
use image::ImageReader;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Cursor, Read, Seek};
use zip::ZipArchive;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FabricModMetadata {
  pub id: String,
  pub version: String,
  pub name: Option<String>,
  pub description: Option<String>,
  pub icon: Option<String>,
  pub authors: Option<Vec<String>>,
  pub contact: Option<HashMap<String, String>>,
}

impl ToTranslatableTable for FabricModMetadata {
  fn to_translatable_table(&self) -> Vec<(TranslatableItem, String)> {
    let mut table = vec![
      (TranslatableItem::Id, self.id.clone()),
      (TranslatableItem::Version, self.version.clone()),
    ];

    if let Some(ref name) = self.name {
      table.push((TranslatableItem::Name, name.clone()));
    }

    if let Some(ref description) = self.description {
      table.push((TranslatableItem::Description, description.clone()));
    }

    if let Some(ref authors) = self.authors {
      let authors_str = authors.clone().join(", ");
      table.push((TranslatableItem::Author, authors_str));
    }

    if let Some(ref contact) = self.contact {
      let contact_str = contact
        .iter()
        .map(|(k, v)| format!("{}: {}", k, v))
        .collect::<Vec<_>>()
        .join(", ");
      table.push((TranslatableItem::Contact, contact_str));
    }

    table
  }
}

pub fn load_fabric_from_jar<R: Read + Seek>(
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
    if let Ok(mut img_file) = jar.by_name(&icon) {
      // Use `image` crate to decode the image
      let mut buffer = Vec::new();
      if let Ok(_) = img_file.read_to_end(&mut buffer) {
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
