// https://mc1122modtutorialdocs-sphinx.readthedocs.io/zh-cn/latest/mainclass/01_mcmodinfo.html
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::models::{ToTranslatableTable, TranslatableItem};
use serde::{Deserialize, Serialize};
use std::io::{Cursor, Read, Seek};
use zip::ZipArchive;

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct OldforgeModMetadata {
  pub modid: String,
  pub name: Option<String>,
  pub description: Option<String>,
  pub version: Option<String>,
  pub logo_file: Option<String>,
  pub mcversion: Option<String>,
  pub url: Option<String>,
  pub update_url: Option<String>,
  pub credits: Option<String>,
  pub author_list: Option<Vec<String>>,
}

impl ToTranslatableTable for OldforgeModMetadata {
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
    if let Some(ref authors) = self.author_list {
      table.push((TranslatableItem::Author, authors.clone().join(", ")));
    }
    if let Some(ref credits) = self.credits {
      table.push((TranslatableItem::Credits, credits.clone()));
    }
    table
  }
}

pub fn load_oldforge_from_jar<R: Read + Seek>(
  jar: &mut ZipArchive<R>,
) -> SJMCLResult<OldforgeModMetadata> {
  let mut meta: Vec<OldforgeModMetadata> = match jar.by_name("mcmod.info") {
    Ok(val) => match serde_json::from_reader(val) {
      Ok(val) => val,
      Err(e) => return Err(SJMCLError::from(e)),
    },
    Err(e) => return Err(SJMCLError::from(e)),
  };
  if meta.is_empty() {
    return Err(SJMCLError("len of OldforgeModMetadata is 0".to_string()));
  }
  Ok(meta.remove(0))
}
