use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::constants::{
  COMPRESSED_ICON_SIZE, TRANSLATION_CACHE_EXPIRY_HOURS, TRANSLATION_CACHE_FILE_NAME,
};
use crate::instance::helpers::mods::{fabric, forge, legacy_forge, liteloader, quilt};
use crate::instance::models::misc::{LocalModInfo, ModLoaderType};
use crate::resource::helpers::curseforge::{
  fetch_remote_resource_by_id_curseforge, fetch_remote_resource_by_local_curseforge,
};
use crate::resource::helpers::modrinth::{
  fetch_remote_resource_by_id_modrinth, fetch_remote_resource_by_local_modrinth,
};
use crate::storage::Storage;
use crate::utils::image::{load_image_from_dir_async, load_image_from_jar, ImageWrapper};
use crate::APP_DATA_DIR;
use image::imageops::FilterType;
use log::info;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

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

pub fn compress_icon(wrapper: ImageWrapper) -> ImageWrapper {
  let resized_image = image::imageops::resize(
    &wrapper.image,
    COMPRESSED_ICON_SIZE.0,
    COMPRESSED_ICON_SIZE.1,
    FilterType::Nearest,
  );
  ImageWrapper {
    image: resized_image,
  }
}

pub async fn get_mod_info_from_jar(path: &PathBuf) -> SJMCLResult<LocalModInfo> {
  let file = Cursor::new(tokio::fs::read(path).await?);
  let file_name = path.file_name().unwrap().to_string_lossy().to_string();
  let file_stem = PathBuf::from(file_name.strip_suffix(".disabled").unwrap_or(&file_name))
    .file_stem()
    .unwrap()
    .to_string_lossy()
    .to_string();
  let file_path = path.clone();
  let enabled = !file_name.ends_with(".disabled");
  let mut jar = ZipArchive::new(file)?;
  if let Ok(meta) = fabric::get_mod_metadata_from_jar(&mut jar) {
    let icon_src = if let Some(icon) = meta.icon {
      load_image_from_jar(&mut jar, &icon)
        .map(ImageWrapper::from)
        .map(compress_icon)
        .unwrap_or_default()
    } else {
      Default::default()
    };
    return Ok(LocalModInfo {
      icon_src,
      enabled,
      name: meta.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version,
      file_name: file_stem,
      description: meta.description.unwrap_or_default(),
      translated_description: None,
      potential_incompatibility: false, // not assigned yet
      loader_type: ModLoaderType::Fabric,
      file_path,
    });
  };
  if let Ok(mut meta) = forge::get_mod_metadata_from_jar(&mut jar) {
    let first_mod = meta.mods.remove(0);
    return Ok(LocalModInfo {
      icon_src: meta.valid_logo_file.map(compress_icon).unwrap_or_default(),
      enabled,
      name: first_mod.display_name.unwrap_or_default(),
      translated_name: None,
      version: first_mod.version.unwrap_or_default(),
      file_name: file_stem,
      description: first_mod.description.unwrap_or_default(),
      translated_description: None,
      potential_incompatibility: false,
      loader_type: meta.loader_type, // Forge or NeoForge
      file_path,
    });
  }
  if let Ok(meta) = legacy_forge::get_mod_metadata_from_jar(&mut jar) {
    let icon_src = if let Some(icon) = meta.logo_file {
      load_image_from_jar(&mut jar, &icon)
        .map(ImageWrapper::from)
        .map(compress_icon)
        .unwrap_or_default()
    } else {
      Default::default()
    };
    return Ok(LocalModInfo {
      icon_src,
      enabled,
      name: meta.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version.unwrap_or_default(),
      file_name: file_stem,
      description: meta.description.unwrap_or_default(),
      translated_description: None,
      potential_incompatibility: false,
      loader_type: ModLoaderType::Forge,
      file_path,
    });
  }
  if let Ok(meta) = liteloader::get_mod_metadata_from_jar(&mut jar) {
    return Ok(LocalModInfo {
      icon_src: Default::default(),
      enabled,
      name: meta.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version.unwrap_or_default(),
      file_name: file_stem,
      description: meta.description.unwrap_or_default(),
      translated_description: None,
      potential_incompatibility: false,
      loader_type: ModLoaderType::LiteLoader,
      file_path,
    });
  }
  if let Ok(meta) = quilt::get_mod_metadata_from_jar(&mut jar) {
    let icon_src = if let Some(icon) = meta.metadata.icon {
      load_image_from_jar(&mut jar, &icon)
        .map(ImageWrapper::from)
        .map(compress_icon)
        .unwrap_or_default()
    } else {
      Default::default()
    };
    return Ok(LocalModInfo {
      icon_src,
      enabled,
      name: meta.metadata.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version,
      file_name: file_stem,
      description: meta.metadata.description.unwrap_or_default(),
      translated_description: None,
      potential_incompatibility: false,
      loader_type: ModLoaderType::Quilt,
      file_path,
    });
  }
  Err(SJMCLError(format!(
    "{} cannot be recognized as known",
    file_name
  )))
}

pub async fn get_mod_info_from_dir(path: &Path) -> SJMCLResult<LocalModInfo> {
  let dir_name = path.file_name().unwrap().to_string_lossy().to_string();
  // only remove .disabled suffix if exists, not consider other extension-like suffix in dir name.
  let dir_stem = dir_name
    .strip_suffix(".disabled")
    .unwrap_or(&dir_name)
    .to_string();
  let enabled = !dir_name.ends_with(".disabled");
  if let Ok(meta) = fabric::get_mod_metadata_from_dir(path).await {
    let icon_src = if let Some(icon) = meta.icon {
      load_image_from_dir_async(&path.join(icon))
        .await
        .map(ImageWrapper::from)
        .map(compress_icon)
        .unwrap_or_default()
    } else {
      Default::default()
    };
    return Ok(LocalModInfo {
      icon_src,
      enabled,
      name: meta.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version,
      file_name: dir_stem,
      description: meta.description.unwrap_or_default(),
      translated_description: None,
      potential_incompatibility: false,
      loader_type: ModLoaderType::Fabric,
      file_path: path.to_path_buf(),
    });
  };
  if let Ok(mut meta) = forge::get_mod_metadata_from_dir(path).await {
    let first_mod = meta.mods.remove(0);
    return Ok(LocalModInfo {
      icon_src: meta.valid_logo_file.map(compress_icon).unwrap_or_default(),
      enabled,
      name: first_mod.display_name.unwrap_or_default(),
      translated_name: None,
      version: first_mod.version.unwrap_or_default(),
      file_name: dir_stem,
      description: first_mod.description.unwrap_or_default(),
      translated_description: None,
      potential_incompatibility: false,
      loader_type: meta.loader_type, // Forge or NeoForge
      file_path: path.to_path_buf(),
    });
  }
  if let Ok(meta) = legacy_forge::get_mod_metadata_from_dir(path).await {
    let icon_src = if let Some(icon) = meta.logo_file {
      load_image_from_dir_async(&path.join(icon))
        .await
        .map(ImageWrapper::from)
        .map(compress_icon)
        .unwrap_or_default()
    } else {
      Default::default()
    };
    return Ok(LocalModInfo {
      icon_src,
      enabled,
      name: meta.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version.unwrap_or_default(),
      file_name: dir_stem,
      description: meta.description.unwrap_or_default(),
      translated_description: None,
      potential_incompatibility: false,
      loader_type: ModLoaderType::Forge,
      file_path: path.to_path_buf(),
    });
  }
  if let Ok(meta) = liteloader::get_mod_metadata_from_dir(path).await {
    return Ok(LocalModInfo {
      icon_src: Default::default(),
      enabled,
      name: meta.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version.unwrap_or_default(),
      file_name: dir_stem,
      description: meta.description.unwrap_or_default(),
      translated_description: None,
      potential_incompatibility: false,
      loader_type: ModLoaderType::LiteLoader,
      file_path: path.to_path_buf(),
    });
  }
  if let Ok(meta) = quilt::get_mod_metadata_from_dir(path).await {
    let icon_src = if let Some(icon) = meta.metadata.icon {
      load_image_from_dir_async(&path.join(icon))
        .await
        .map(ImageWrapper::from)
        .map(compress_icon)
        .unwrap_or_default()
    } else {
      Default::default()
    };
    return Ok(LocalModInfo {
      icon_src,
      enabled,
      name: meta.metadata.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version,
      file_name: dir_stem,
      description: meta.metadata.description.unwrap_or_default(),
      translated_description: None,
      potential_incompatibility: false,
      loader_type: ModLoaderType::Quilt,
      file_path: path.to_path_buf(),
    });
  }

  Err(SJMCLError(format!(
    "{} cannot be recognized as known",
    dir_name
  )))
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
