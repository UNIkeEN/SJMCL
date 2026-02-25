// This file is used to read mod info for Forge or NeoForge (structure almost identical)
// https://forge.gemwire.uk/wiki/Mods.toml
// https://docs.neoforged.net/docs/gettingstarted/modfiles/#neoforgemodstoml
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::helpers::mods::common::{compress_icon, LocalModMetadataParser};
use crate::instance::models::misc::{LocalModInfo, ModLoaderType};
use crate::utils::image::{load_image_from_dir_async, load_image_from_jar, ImageWrapper};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Cursor, Read, Seek};
use std::path::Path;
use zip::ZipArchive;
use {java_properties, tokio, toml};

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ForgeModMetadata {
  pub loader_type: ModLoaderType,
  pub mod_loader: String,
  pub loader_version: String,
  pub license: String,
  pub mods: Vec<ForgeModSubItem>,
  // some non-standard mods write logo_file field in toml meta section.
  pub logo_file: Option<String>,
  // not in file, added by sjmcl
  pub valid_logo_file: Option<ImageWrapper>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ForgeModSubItem {
  pub mod_id: String,
  pub namespace: Option<String>,
  pub version: Option<String>,
  pub display_name: Option<String>,
  pub display_url: Option<String>,
  pub credits: Option<String>,
  pub authors: Option<Value>,
  pub description: Option<String>,
  pub logo_file: Option<String>,
}

impl From<ForgeModMetadata> for LocalModInfo {
  fn from(mut meta: ForgeModMetadata) -> Self {
    let first_mod = meta.mods.remove(0);
    Self {
      name: first_mod.display_name.unwrap_or_default(),
      version: first_mod.version.unwrap_or_default(),
      description: first_mod.description.unwrap_or_default(),
      loader_type: meta.loader_type,
      ..Default::default()
    }
  }
}

#[derive(Clone, Copy)]
pub struct ForgeModMetadataParser;

#[async_trait]
impl LocalModMetadataParser for ForgeModMetadataParser {
  type Metadata = ForgeModMetadata;

  fn get_mod_metadata_from_jar<R: Read + Seek>(
    jar: &mut ZipArchive<R>,
  ) -> SJMCLResult<Self::Metadata> {
    let mut meta_result = None;
    if let Ok(mut file) = jar.by_name("META-INF/mods.toml") {
      let mut buf = String::new();
      file.read_to_string(&mut buf)?;
      let mut meta = toml::from_str::<ForgeModMetadata>(&buf)?;
      meta.loader_type = ModLoaderType::Forge;
      meta_result = Some(meta);
    }
    if meta_result.is_none() {
      if let Ok(mut file) = jar.by_name("META-INF/neoforge.mods.toml") {
        let mut buf = String::new();
        file.read_to_string(&mut buf)?;
        let mut meta = toml::from_str::<ForgeModMetadata>(&buf)?;
        meta.loader_type = ModLoaderType::NeoForge;
        meta_result = Some(meta);
      }
    }
    let mut meta = match meta_result {
      Some(val) => val,
      None => {
        return Err(SJMCLError(
          "no mods.toml or neoforge.mods.toml found".to_string(),
        ));
      }
    };
    if meta.mods.is_empty() {
      return Err(SJMCLError("forge mod len(mods) == 0".to_string()));
    }
    // seek logo
    let mut logo_candidates = vec![];
    if let Some(path) = &meta.logo_file {
      logo_candidates.push(path.clone());
    }
    for m in &meta.mods {
      if let Some(path) = &m.logo_file {
        logo_candidates.push(path.clone());
      }
    }
    for path in logo_candidates {
      if let Some(img) = load_image_from_jar(jar, &path) {
        meta.valid_logo_file = Some(img.into());
        break;
      }
    }
    // fallback to get version
    if let Some(ref mut version) = meta.mods[0].version {
      if version == "${file.jarVersion}" {
        if let Ok(mf_file) = jar.by_name("META-INF/MANIFEST.MF") {
          if let Ok(mf) = java_properties::read(mf_file) {
            if let Some(jar_version) = mf.get("Implementation-Version") {
              *version = jar_version.clone();
            }
          }
        }
      }
    }
    Ok(meta)
  }

  async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<Self::Metadata> {
    let mut meta_result = None;
    if let Ok(val) = tokio::fs::read_to_string(dir_path.join("META-INF/mods.toml")).await {
      let mut meta = toml::from_str::<ForgeModMetadata>(val.as_str())?;
      meta.loader_type = ModLoaderType::Forge;
      meta_result = Some(meta);
    }
    if meta_result.is_none() {
      if let Ok(val) = tokio::fs::read_to_string(dir_path.join("META-INF/neoforge.mods.toml")).await
      {
        let mut meta = toml::from_str::<ForgeModMetadata>(val.as_str())?;
        meta.loader_type = ModLoaderType::NeoForge;
        meta_result = Some(meta);
      }
    }
    let mut meta = match meta_result {
      Some(val) => val,
      None => {
        return Err(SJMCLError(
          "no mods.toml or neoforge.mods.toml found".to_string(),
        ));
      }
    };
    if meta.mods.is_empty() {
      return Err(SJMCLError("forge mod len(mods) == 0".to_string()));
    }
    // seek logo
    let mut logo_candidates = vec![];
    if let Some(path) = &meta.logo_file {
      logo_candidates.push(dir_path.join(path));
    }
    for m in &meta.mods {
      if let Some(path) = &m.logo_file {
        logo_candidates.push(dir_path.join(path));
      }
    }
    for path in logo_candidates {
      if let Some(img) = load_image_from_dir_async(&path).await {
        meta.valid_logo_file = Some(img.into());
        break;
      }
    }
    // fallback to get version
    if let Some(ref mut version) = meta.mods[0].version {
      if version == "${file.jarVersion}" {
        if let Ok(mf_string) =
          tokio::fs::read_to_string(dir_path.join("META-INF/MANIFEST.MF")).await
        {
          if let Ok(mf) = java_properties::read(Cursor::new(mf_string)) {
            if let Some(jar_version) = mf.get("Implementation-Version") {
              *version = jar_version.clone();
            }
          }
        }
      }
    }
    Ok(meta)
  }

  fn wrap_icon_from_jar<R: Read + Seek>(
    meta: &mut Self::Metadata,
    _jar: &mut ZipArchive<R>,
  ) -> ImageWrapper {
    meta
      .valid_logo_file
      .take()
      .map(compress_icon)
      .unwrap_or_default()
  }

  async fn wrap_icon_from_dir(meta: &mut Self::Metadata, _dir_path: &Path) -> ImageWrapper {
    meta
      .valid_logo_file
      .take()
      .map(compress_icon)
      .unwrap_or_default()
  }
}
