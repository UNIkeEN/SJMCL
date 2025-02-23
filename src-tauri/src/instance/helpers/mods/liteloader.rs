// https://www.mcmod.cn/class/610.html
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::models::{ToTranslatableTable, TranslatableItem};
use serde::{Deserialize, Serialize};
use std::io::{Cursor, Read, Seek};
use zip::ZipArchive;

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct LiteloaderModMetadata {
  pub name: Option<String>,
  pub version: Option<String>,
  pub mcversion: Option<String>,
  pub revision: Option<String>,
  pub author: Option<String>,
  pub class_transformer_classes: Vec<String>,
  pub description: Option<String>,
  pub modpack_name: Option<String>,
  pub modpack_version: Option<String>,
  pub check_update_url: Option<String>,
  pub update_uri: Option<String>,
}

impl ToTranslatableTable for LiteloaderModMetadata {
  fn to_translatable_table(&self) -> Vec<(TranslatableItem, String)> {
    let mut table = vec![];
    if let Some(ref name) = self.name {
      table.push((TranslatableItem::Name, name.clone()));
    }
    if let Some(ref version) = self.version {
      table.push((TranslatableItem::Version, version.clone()));
    }
    if let Some(ref description) = self.description {
      table.push((TranslatableItem::Description, description.clone()));
    }
    if let Some(ref authors) = self.author {
      table.push((TranslatableItem::Author, authors.clone()));
    }
    if let Some(ref mcversion) = self.mcversion {
      table.push((TranslatableItem::McVersion, mcversion.clone()));
    }
    table
  }
}

pub fn load_liteloader_from_jar<R: Read + Seek>(
  jar: &mut ZipArchive<R>,
) -> SJMCLResult<LiteloaderModMetadata> {
  let meta: LiteloaderModMetadata = match jar.by_name("litemod.json") {
    Ok(val) => match serde_json::from_reader(val) {
      Ok(val) => val,
      Err(e) => return Err(SJMCLError::from(e)),
    },
    Err(e) => return Err(SJMCLError::from(e)),
  };
  Ok(meta)
}
