use super::{
  fabric::{load_fabric_from_dir, load_fabric_from_jar},
  liteloader::{load_liteloader_from_dir, load_liteloader_from_jar},
  neoforge::{load_neoforge_from_dir, load_neoforge_from_jar},
  new_forge::{load_newforge_from_dir, load_newforge_from_jar},
  old_forge::{load_oldforge_from_dir, load_oldforge_from_jar},
  quilt::{load_quiltmod_from_dir, load_quiltmod_from_jar},
};
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::models::{LocalModInfo, ModLoaderType};
use std::io::Cursor;
use std::path::PathBuf;
use tokio;
use zip::ZipArchive;

pub async fn load_mod_from_file(path: &PathBuf) -> SJMCLResult<LocalModInfo> {
  let file = Cursor::new(tokio::fs::read(path).await?);
  let file_name = path.file_name().unwrap().to_string_lossy().to_string();
  let file_stem = path.file_stem().unwrap().to_string_lossy().to_string();
  let file_path = path.clone();
  let enabled = !file_name.ends_with(".disabled");
  let mut jar = ZipArchive::new(file)?;
  if let Ok(meta) = load_fabric_from_jar(&mut jar) {
    return Ok(LocalModInfo {
      icon_src: meta.icon.unwrap_or_default(),
      enabled,
      name: meta.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version,
      file_name: file_stem,
      description: meta.description.unwrap_or_default(),
      potential_incompatibility: false,
      loader_type: ModLoaderType::Fabric,
      file_path,
    });
  };
  if let Ok(mut meta) = load_newforge_from_jar(&mut jar) {
    let first_mod = meta.mods.remove(0);
    return Ok(LocalModInfo {
      icon_src: first_mod.logo_file.unwrap_or_default(),
      enabled,
      name: first_mod.display_name.unwrap_or_default(),
      translated_name: None,
      version: first_mod.version.unwrap_or_default(),
      file_name: file_stem,
      description: first_mod.description.unwrap_or_default(),
      potential_incompatibility: false,
      loader_type: ModLoaderType::Forge,
      file_path,
    });
  }
  if let Ok(mut meta) = load_neoforge_from_jar(&mut jar) {
    let first_mod = meta.mods.remove(0);
    return Ok(LocalModInfo {
      icon_src: first_mod.logo_file.unwrap_or_default(),
      enabled,
      name: first_mod.display_name.unwrap_or_default(),
      translated_name: None,
      version: first_mod.version.unwrap_or_default(),
      file_name: file_stem,
      description: first_mod.description.unwrap_or_default(),
      potential_incompatibility: false,
      loader_type: ModLoaderType::NeoForge,
      file_path,
    });
  }
  if let Ok(meta) = load_oldforge_from_jar(&mut jar) {
    return Ok(LocalModInfo {
      icon_src: meta.logo_file.unwrap_or_default(),
      enabled,
      name: meta.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version.unwrap_or_default(),
      file_name: file_stem,
      description: meta.description.unwrap_or_default(),
      potential_incompatibility: false,
      loader_type: ModLoaderType::Forge,
      file_path,
    });
  }
  if let Ok(meta) = load_liteloader_from_jar(&mut jar) {
    return Ok(LocalModInfo {
      icon_src: String::new(),
      enabled,
      name: meta.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version.unwrap_or_default(),
      file_name: file_stem,
      description: meta.description.unwrap_or_default(),
      potential_incompatibility: false,
      loader_type: ModLoaderType::LiteLoader,
      file_path,
    });
  }

  if let Ok(meta) = load_quiltmod_from_jar(&mut jar) {
    return Ok(LocalModInfo {
      icon_src: meta.metadata.icon.unwrap_or_default(),
      enabled,
      name: meta.metadata.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version,
      file_name: file_stem,
      description: meta.metadata.description.unwrap_or_default(),
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

pub async fn load_mod_from_dir(path: &PathBuf) -> SJMCLResult<LocalModInfo> {
  let file_name = path.file_name().unwrap().to_string_lossy().to_string();
  let file_stem = path.file_stem().unwrap().to_string_lossy().to_string();
  let file_path = path.clone();
  let enabled = !file_name.ends_with(".disabled");
  if let Ok(meta) = load_fabric_from_dir(&path).await {
    return Ok(LocalModInfo {
      icon_src: meta.icon.unwrap_or_default(),
      enabled,
      name: meta.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version,
      file_name: file_stem,
      description: meta.description.unwrap_or_default(),
      potential_incompatibility: false,
      loader_type: ModLoaderType::Fabric,
      file_path,
    });
  };
  if let Ok(mut meta) = load_newforge_from_dir(&path).await {
    let first_mod = meta.mods.remove(0);
    return Ok(LocalModInfo {
      icon_src: first_mod.logo_file.unwrap_or_default(),
      enabled,
      name: first_mod.display_name.unwrap_or_default(),
      translated_name: None,
      version: first_mod.version.unwrap_or_default(),
      file_name: file_stem,
      description: first_mod.description.unwrap_or_default(),
      potential_incompatibility: false,
      loader_type: ModLoaderType::Forge,
      file_path,
    });
  }
  if let Ok(mut meta) = load_neoforge_from_dir(&path).await {
    let first_mod = meta.mods.remove(0);
    return Ok(LocalModInfo {
      icon_src: first_mod.logo_file.unwrap_or_default(),
      enabled,
      name: first_mod.display_name.unwrap_or_default(),
      translated_name: None,
      version: first_mod.version.unwrap_or_default(),
      file_name: file_stem,
      description: first_mod.description.unwrap_or_default(),
      potential_incompatibility: false,
      loader_type: ModLoaderType::NeoForge,
      file_path,
    });
  }
  if let Ok(meta) = load_oldforge_from_dir(&path).await {
    return Ok(LocalModInfo {
      icon_src: meta.logo_file.unwrap_or_default(),
      enabled,
      name: meta.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version.unwrap_or_default(),
      file_name: file_stem,
      description: meta.description.unwrap_or_default(),
      potential_incompatibility: false,
      loader_type: ModLoaderType::Forge,
      file_path,
    });
  }
  if let Ok(meta) = load_liteloader_from_dir(&path).await {
    return Ok(LocalModInfo {
      icon_src: String::new(),
      enabled,
      name: meta.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version.unwrap_or_default(),
      file_name: file_stem,
      description: meta.description.unwrap_or_default(),
      potential_incompatibility: false,
      loader_type: ModLoaderType::LiteLoader,
      file_path,
    });
  }

  if let Ok(meta) = load_quiltmod_from_dir(&path).await {
    return Ok(LocalModInfo {
      icon_src: meta.metadata.icon.unwrap_or_default(),
      enabled,
      name: meta.metadata.name.unwrap_or_default(),
      translated_name: None,
      version: meta.version,
      file_name: file_stem,
      description: meta.metadata.description.unwrap_or_default(),
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
