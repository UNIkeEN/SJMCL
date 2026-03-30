use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::constants::{TRANSLATION_CACHE_EXPIRY_HOURS, TRANSLATION_CACHE_FILE_NAME};
use crate::instance::models::misc::LocalModInfo;
use crate::resource::helpers::curseforge::{
  fetch_remote_resource_by_id_curseforge, fetch_remote_resource_by_local_curseforge,
};
use crate::resource::helpers::modrinth::{
  fetch_remote_resource_by_id_modrinth, fetch_remote_resource_by_local_modrinth,
};
use crate::storage::Storage;
use crate::APP_DATA_DIR;
use log::info;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

// Cache structure for local mod translations
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LocalModTranslationsCache {
  #[serde(flatten)]
  pub translations: std::collections::HashMap<String, LocalModTranslationEntry>,
}

impl Storage for LocalModTranslationsCache {
  fn file_path() -> PathBuf {
    APP_DATA_DIR
      .get()
      .unwrap()
      .join(TRANSLATION_CACHE_FILE_NAME)
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModTranslationEntry {
  pub translated_name: Option<String>,
  pub translated_description: Option<String>,
  pub timestamp: u64,
}

impl LocalModTranslationEntry {
  pub fn new(translated_name: Option<String>, translated_description: Option<String>) -> Self {
    Self {
      translated_name,
      translated_description,
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

pub async fn add_local_mod_translations(
  app: &AppHandle,
  mod_info: &mut LocalModInfo,
) -> SJMCLResult<()> {
  let cache = {
    let translation_cache_state = app.state::<Mutex<LocalModTranslationsCache>>();
    let cache = translation_cache_state.lock()?.clone();
    cache
  };
  let file_path = mod_info.file_path.to_string_lossy().to_string();
  let file_name = mod_info.file_name.clone();

  if let Some(entry) = cache.translations.get(&file_name) {
    if !entry.is_expired(TRANSLATION_CACHE_EXPIRY_HOURS) {
      info!("Using cached translation for mod: {}", file_name);
      mod_info.translated_name = entry.translated_name.clone();
      mod_info.translated_description = entry.translated_description.clone();
      return Ok(());
    }
  }

  // Try both services concurrently and use the fastest successful response
  let modrinth_result = {
    let app_clone = app.clone();
    let file_path_clone = file_path.clone();
    tokio::spawn(async move {
      let file_info = fetch_remote_resource_by_local_modrinth(&app_clone, &file_path_clone).await?;
      let resource_info =
        fetch_remote_resource_by_id_modrinth(&app_clone, &file_info.resource_id).await?;
      Ok::<_, SJMCLError>(resource_info)
    })
  };

  let curseforge_result = {
    let app_clone = app.clone();
    let file_path_clone = file_path.clone();
    tokio::spawn(async move {
      let file_info =
        fetch_remote_resource_by_local_curseforge(&app_clone, &file_path_clone).await?;
      let resource_info =
        fetch_remote_resource_by_id_curseforge(&app_clone, &file_info.resource_id).await?;
      Ok::<_, SJMCLError>(resource_info)
    })
  };

  let (modrinth_res, curseforge_res) = tokio::join!(modrinth_result, curseforge_result);

  // Prefer Modrinth result if both are successful
  let final_result = match (modrinth_res, curseforge_res) {
    (Ok(Ok(modrinth_data)), _) => Some(modrinth_data),
    (_, Ok(Ok(curseforge_data))) => Some(curseforge_data),
    _ => None,
  };

  if let Some(resource_info) = final_result {
    info!("Fetched translation for mod: {}", file_name);
    mod_info.translated_name = resource_info.translated_name.clone();
    mod_info.translated_description = resource_info.translated_description.clone();
  }
  Ok(())
}
