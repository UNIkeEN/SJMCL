use smart_default::SmartDefault;
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serialize_skip_none_derive::serialize_skip_none;
use tauri::AppHandle;
use tokio::sync::Semaphore;
use zip::ZipArchive;

use crate::error::SJMCLResult;
use crate::instance::helpers::modpack::export::{
  normalize_mod_loader_version, ExportModpackOptions, ModpackExportBundle,
};
use crate::instance::helpers::modpack::import::{ModpackManifest, ModpackMetaInfo};
use crate::instance::models::misc::{Instance, InstanceError, ModLoader, ModLoaderType};
use crate::resource::helpers::{
  curseforge::fetch_remote_resource_by_local_curseforge,
  modrinth::fetch_remote_resource_by_local_modrinth,
};
use crate::resource::models::OtherResourceSource;
use crate::tasks::download::DownloadParam;
use crate::tasks::PTaskParam;
use sha1::Digest;

structstruck::strike! {
#[strikethrough[serialize_skip_none]]
#[strikethrough[derive(Deserialize, Serialize, Debug, Clone)]]
#[strikethrough[serde(rename_all = "camelCase")]]
pub struct ModrinthFile {
  pub path: String,
  pub hashes: struct ModrinthFileHashes {
    pub sha1: String,
    pub sha512: String,
  },
  pub env: Option<pub struct ModrinthFileEnv {
    pub client: String,
    pub server: String,
  }>,
  pub downloads: Vec<String>,
  pub file_size: u64,
}
}

#[serialize_skip_none]
#[derive(Deserialize, Serialize, Debug, Clone, SmartDefault)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthManifest {
  #[default = 1]
  pub format_version: u64,
  #[default = "minecraft"]
  pub game: String,
  pub version_id: String,
  pub name: String,
  pub summary: Option<String>,
  pub files: Vec<ModrinthFile>,
  pub dependencies: HashMap<String, String>,
}

#[async_trait]
impl ModpackManifest for ModrinthManifest {
  fn from_archive(file: &File) -> SJMCLResult<Self> {
    let mut archive = ZipArchive::new(file)?;
    let mut manifest_file = archive.by_name("modrinth.index.json")?;
    let mut manifest_content = String::new();
    manifest_file.read_to_string(&mut manifest_content)?;
    let manifest: Self = serde_json::from_str(&manifest_content).inspect_err(|e| {
      eprintln!("{:?}", e);
    })?;
    Ok(manifest)
  }

  async fn get_meta_info(&self, app: &AppHandle) -> SJMCLResult<ModpackMetaInfo> {
    let client_version = self.get_client_version()?;
    let mod_loader = if let Ok((loader_type, version)) = self.get_mod_loader_type_version() {
      Some(
        ModLoader {
          loader_type,
          version,
          ..Default::default()
        }
        .with_branch(app, client_version.clone())
        .await?,
      )
    } else {
      None
    };
    Ok(ModpackMetaInfo {
      name: self.name.clone(),
      version: Some(self.version_id.clone()),
      description: self.summary.clone(),
      author: None,
      modpack_source: OtherResourceSource::Modrinth,
      client_version,
      mod_loader,
    })
  }

  fn get_client_version(&self) -> SJMCLResult<String> {
    Ok(
      self
        .dependencies
        .get("minecraft")
        .ok_or(InstanceError::ModpackManifestParseError)?
        .to_string(),
    )
  }

  fn get_mod_loader_type_version(&self) -> SJMCLResult<(ModLoaderType, String)> {
    for (key, val) in &self.dependencies {
      match key.as_str() {
        "minecraft" => continue,
        "forge" => return Ok((ModLoaderType::Forge, val.to_string())),
        "fabric-loader" => return Ok((ModLoaderType::Fabric, val.to_string())),
        "neoforge" => return Ok((ModLoaderType::NeoForge, val.to_string())),
        _ => return Err(InstanceError::UnsupportedModLoader.into()),
      }
    }
    Err(InstanceError::ModpackManifestParseError.into())
  }

  async fn get_download_params(
    &self,
    _app: &AppHandle,
    instance_path: &Path,
  ) -> SJMCLResult<Vec<PTaskParam>> {
    self
      .files
      .iter()
      .map(|file| {
        let download_url = file
          .downloads
          .first()
          .ok_or(InstanceError::InvalidSourcePath)?;
        Ok(PTaskParam::Download(DownloadParam {
          src: url::Url::parse(download_url).map_err(|_| InstanceError::InvalidSourcePath)?,
          sha1: Some(file.hashes.sha1.clone()),
          dest: instance_path.join(&file.path),
          filename: None,
        }))
      })
      .collect::<SJMCLResult<Vec<_>>>()
  }

  fn get_overrides_path(&self) -> String {
    "overrides/".to_string()
  }
}

pub async fn build_modrinth_export_bundle(
  app: &AppHandle,
  instance: &Instance,
  options: &ExportModpackOptions,
  selected_files: &[(String, PathBuf)],
) -> SJMCLResult<ModpackExportBundle> {
  let mut manifest = generate_modrinth_manifest(instance, options);
  let no_create_remote_files = options.no_create_remote_files.unwrap_or(false);
  let skip_curseforge = options.skip_curseforge_remote_files.unwrap_or(false);
  let (modrinth_files, override_files) =
    collect_modrinth_files(app, selected_files, no_create_remote_files, skip_curseforge).await?;

  manifest.files = modrinth_files;
  let json = serde_json::to_string_pretty(&manifest)
    .map_err(|_| InstanceError::ModpackManifestParseError)?;

  Ok(ModpackExportBundle {
    overrides_prefix: "overrides".to_string(),
    overrides_files: override_files,
    extra_files: vec![("modrinth.index.json".to_string(), json)],
  })
}

fn generate_modrinth_manifest(
  instance: &Instance,
  options: &ExportModpackOptions,
) -> ModrinthManifest {
  let mut dependencies = HashMap::new();
  dependencies.insert("minecraft".to_string(), instance.version.clone());

  if instance.mod_loader.loader_type != ModLoaderType::Unknown {
    let version = normalize_mod_loader_version(&instance.mod_loader.version);
    let loader_key = match instance.mod_loader.loader_type {
      ModLoaderType::Forge | ModLoaderType::LegacyForge => "forge",
      ModLoaderType::Fabric => "fabric-loader",
      ModLoaderType::NeoForge => "neoforge",
      ModLoaderType::Quilt => "quilt-loader",
      _ => "",
    };

    if !loader_key.is_empty() {
      dependencies.insert(loader_key.to_string(), version);
    }
  }

  ModrinthManifest {
    version_id: options.version.clone(),
    name: options.name.clone(),
    summary: options.description.clone(),
    files: Vec::new(),
    dependencies,
    ..Default::default()
  }
}

async fn build_modrinth_remote_file(
  app: &AppHandle,
  rel: &str,
  full: &Path,
  skip_curseforge: bool,
) -> SJMCLResult<Option<ModrinthFile>> {
  let is_disabled = rel.ends_with(".disabled");
  let manifest_path = if is_disabled {
    rel.trim_end_matches(".disabled").to_string()
  } else {
    rel.to_string()
  };

  let mut downloads = Vec::new();

  if let Ok(remote) =
    fetch_remote_resource_by_local_modrinth(app, full.to_string_lossy().as_ref()).await
  {
    downloads.push(remote.download_url);
  }

  if !skip_curseforge {
    if let Ok(remote) =
      fetch_remote_resource_by_local_curseforge(app, full.to_string_lossy().as_ref()).await
    {
      downloads.push(remote.download_url);
    }
  }

  if downloads.is_empty() {
    return Ok(None);
  }

  let file_content = tokio::fs::read(full).await?;
  let mut sha1_hasher = sha1::Sha1::new();
  let mut sha512_hasher = sha2::Sha512::new();
  sha1_hasher.update(&file_content);
  sha512_hasher.update(&file_content);
  let sha1 = hex::encode(sha1_hasher.finalize());
  let sha512 = hex::encode(sha512_hasher.finalize());
  let file_size = file_content.len() as u64;
  let env = if is_disabled {
    Some(ModrinthFileEnv {
      client: "optional".to_string(),
      server: "unsupported".to_string(),
    })
  } else {
    None
  };

  Ok(Some(ModrinthFile {
    path: manifest_path,
    hashes: ModrinthFileHashes { sha1, sha512 },
    env,
    downloads,
    file_size,
  }))
}

async fn collect_modrinth_files(
  app: &AppHandle,
  selected_files: &[(String, PathBuf)],
  no_create_remote_files: bool,
  skip_curseforge: bool,
) -> SJMCLResult<(Vec<ModrinthFile>, Vec<(String, PathBuf)>)> {
  if no_create_remote_files {
    return Ok((Vec::new(), selected_files.to_vec()));
  }

  let is_remote_candidate = |rel: &str| {
    rel.starts_with("mods/") || rel.starts_with("resourcepacks/") || rel.starts_with("shaderpacks/")
  };

  let mut tasks = Vec::new();
  let semaphore = Arc::new(Semaphore::new(
    std::thread::available_parallelism().unwrap().into(),
  ));

  for (rel, full) in selected_files {
    let rel = rel.clone();
    let full = full.clone();
    let app = app.clone();
    let permit = semaphore
      .clone()
      .acquire_owned()
      .await
      .map_err(|_| InstanceError::SemaphoreAcquireFailed)?;

    let task = tokio::spawn({
      let rel = rel.clone();
      let full = full.clone();

      async move {
        let result = if is_remote_candidate(&rel) {
          build_modrinth_remote_file(&app, &rel, &full, skip_curseforge)
            .await
            .ok()
            .flatten()
        } else {
          None
        };

        drop(permit);
        result
      }
    });

    tasks.push((rel, full, task));
  }

  let mut modrinth_files = Vec::new();
  let mut override_files = Vec::new();

  for (rel, full, task) in tasks {
    match task.await {
      Ok(Some(modrinth_file)) => {
        modrinth_files.push(modrinth_file);
      }
      Ok(None) | Err(_) => {
        override_files.push((rel, full));
      }
    }
  }

  Ok((modrinth_files, override_files))
}
