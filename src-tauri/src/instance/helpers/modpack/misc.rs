use crate::error::SJMCLResult;
use crate::instance::helpers::modpack::curseforge::CurseForgeManifest;
use crate::instance::helpers::modpack::modrinth::ModrinthManifest;
use crate::instance::helpers::modpack::multimc::MultiMcManifest;
use crate::instance::models::misc::{InstanceError, ModLoader};
use crate::resource::models::OtherResourceSource;
use ripunzip::{NullProgressReporter, UnzipEngine, UnzipOptions};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::path::{Path, PathBuf};
use std::{fs, process};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModpackMetaInfo {
  pub name: String,
  pub version: String,
  pub description: Option<String>,
  pub author: Option<String>,
  pub modpack_source: OtherResourceSource,
  pub client_version: String,
  pub mod_loader: ModLoader,
}

impl ModpackMetaInfo {
  pub async fn from_archive(file: &File) -> SJMCLResult<Self> {
    if let Ok(manifest) = CurseForgeManifest::from_archive(file) {
      let client_version = manifest.get_client_version();
      let (loader_type, version) = manifest.get_mod_loader_type_version();
      Ok(ModpackMetaInfo {
        modpack_source: OtherResourceSource::CurseForge,
        name: manifest.name,
        version: manifest.version,
        description: None,
        author: Some(manifest.author),
        client_version,
        mod_loader: ModLoader {
          loader_type,
          version,
          ..Default::default()
        },
      })
    } else if let Ok(manifest) = ModrinthManifest::from_archive(file) {
      let client_version = manifest.get_client_version()?;
      let (loader_type, version) = manifest.get_mod_loader_type_version()?;
      Ok(ModpackMetaInfo {
        modpack_source: OtherResourceSource::Modrinth,
        name: manifest.name,
        version: manifest.version_id,
        description: manifest.summary,
        author: None,
        client_version,
        mod_loader: ModLoader {
          loader_type,
          version,
          ..Default::default()
        },
      })
    } else if let Ok(manifest) = MultiMcManifest::from_archive(file) {
      let client_version = manifest.get_client_version()?;
      let (loader_type, version) = manifest.get_mod_loader_type_version()?;
      Ok(ModpackMetaInfo {
        modpack_source: OtherResourceSource::Modrinth,
        name: manifest.cfg.get("name").cloned().unwrap_or_default(),
        version: String::new(),
        description: None,
        author: None,
        client_version,
        mod_loader: ModLoader {
          loader_type,
          version,
          ..Default::default()
        },
      })
    } else {
      Err(InstanceError::ModpackManifestParseError.into())
    }
  }
}

pub fn extract_overrides(
  app: &AppHandle,
  overrides_path: &String,
  file: File,
  instance_path: &Path,
) -> SJMCLResult<()> {
  let engine = UnzipEngine::for_file(file).unwrap();

  let pid = process::id();
  let temp_name = format!("ripunzip_overrides_{}", pid);
  let temp_path: PathBuf = app
    .path()
    .resolve::<PathBuf>(PathBuf::from(&temp_name), BaseDirectory::Temp)?;
  fs::create_dir_all(&temp_path)?;

  let options = UnzipOptions {
    output_directory: Some(temp_path.clone()),
    password: None,
    single_threaded: false,
    filename_filter: None,
    progress_reporter: Box::new(NullProgressReporter),
  };

  engine.unzip(options).expect("Unzip failed");

  let overrides_path_buf = PathBuf::from(overrides_path.as_str());
  let extracted_overrides = temp_path.join(overrides_path_buf);

  if extracted_overrides.exists() {
    for entry in fs::read_dir(&extracted_overrides)? {
      let entry = entry?;
      let from = entry.path();
      let to = instance_path.join(entry.file_name());
      fs::rename(from, to)?;
    }
  }

  fs::remove_dir_all(&temp_path)?;

  Ok(())
}
