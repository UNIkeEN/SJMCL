use crate::APP_DATA_DIR;
use crate::resource::models::OtherResourceSource;
use serde::{Deserialize, Serialize};
use sjmcl_types::storage::Storage;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const RESOURCE_TRANSLATION_CACHE_FILE_NAME: &str = "resource_description_translations.json";
pub const RESOURCE_TRANSLATION_CACHE_EXPIRY_HOURS: u64 = 24 * 30;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResourceTranslationsCache {
  #[serde(flatten)]
  pub translations: HashMap<String, ResourceTranslationEntry>,
}

impl ResourceTranslationsCache {
  pub fn cache_key(source: &OtherResourceSource, resource_id: &str) -> String {
    let source = match source {
      OtherResourceSource::CurseForge => "curseforge",
      OtherResourceSource::Modrinth => "modrinth",
      OtherResourceSource::MultiMc => "multimc",
      OtherResourceSource::Unknown => "unknown",
    };

    format!("{}:{}", source, resource_id)
  }
}

impl Storage for ResourceTranslationsCache {
  fn file_path() -> PathBuf {
    APP_DATA_DIR
      .get()
      .unwrap()
      .join(RESOURCE_TRANSLATION_CACHE_FILE_NAME)
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceTranslationEntry {
  #[serde(default)]
  pub translated_name: Option<String>,
  pub translated_description: Option<String>,
  #[serde(default)]
  pub description_translated: bool,
  pub timestamp: u64,
}

impl ResourceTranslationEntry {
  pub fn new(
    translated_name: Option<String>,
    translated_description: Option<String>,
    description_translated: bool,
  ) -> Self {
    Self {
      translated_name,
      translated_description,
      description_translated,
      timestamp: SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs(),
    }
  }

  pub fn is_expired(&self, max_age_hours: u64) -> bool {
    let current_time = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .unwrap_or_default()
      .as_secs();
    current_time > self.timestamp + (max_age_hours * 60 * 60)
  }
}
