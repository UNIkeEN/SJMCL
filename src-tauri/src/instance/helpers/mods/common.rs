use super::{fabric, forge, legacy_forge, liteloader, quilt};
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::models::misc::{LocalModInfo, ModLoaderType};
use crate::resource::{
  helpers::{
    curseforge::{
      fetch_remote_resource_by_id_curseforge, fetch_remote_resource_by_local_curseforge,
      misc::translate_description_curseforge,
    },
    mod_db::ModDataBase,
    modrinth::{
      fetch_remote_resource_by_id_modrinth, fetch_remote_resource_by_local_modrinth,
      misc::translate_description_modrinth,
    },
  },
  models::OtherResourceSource,
};
use crate::utils::image::{load_image_from_dir_async, load_image_from_jar};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tokio;
use zip::ZipArchive;

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
      load_image_from_jar(&mut jar, &icon).unwrap_or_default()
    } else {
      Default::default()
    }
    .into();
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
      icon_src: meta.valid_logo_file.unwrap_or_default(),
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
      load_image_from_jar(&mut jar, &icon).unwrap_or_default()
    } else {
      Default::default()
    }
    .into();
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
      load_image_from_jar(&mut jar, &icon).unwrap_or_default()
    } else {
      Default::default()
    }
    .into();
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
        .unwrap_or_default()
    } else {
      Default::default()
    }
    .into();
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
      icon_src: meta.valid_logo_file.unwrap_or_default(),
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
        .unwrap_or_default()
    } else {
      Default::default()
    }
    .into();
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
        .unwrap_or_default()
    } else {
      Default::default()
    }
    .into();
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

pub async fn add_mod_translations(app: &AppHandle, mod_info: &mut LocalModInfo) -> SJMCLResult<()> {
  let file_path = mod_info.file_path.to_string_lossy().to_string();

  let mut use_modrinth = true;
  let mut resource_id = None;

  // Try Modrinth first
  if let Ok(file_info) = fetch_remote_resource_by_local_modrinth(app, &file_path).await {
    resource_id = Some(file_info.resource_id.clone());
  } else {
    // Fallback to CurseForge
    if let Ok(file_info) = fetch_remote_resource_by_local_curseforge(app, &file_path).await {
      resource_id = Some(file_info.resource_id.clone());
      use_modrinth = false;
    }
  }

  if let Some(id) = resource_id {
    let resource_info_result = if use_modrinth {
      fetch_remote_resource_by_id_modrinth(app, &id).await
    } else {
      fetch_remote_resource_by_id_curseforge(app, &id).await
    };

    if let Ok(resource_info) = resource_info_result {
      mod_info.translated_name = resource_info.translated_name;
      mod_info.translated_description = resource_info.translated_description;
    }
  }

  Ok(())
}
