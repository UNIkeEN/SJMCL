use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sjmcl_types::error::SJMCLResult;
use std::collections::HashMap;
use std::fs;
use std::fs::File;
use std::path::Path;
use tauri::AppHandle;
use zip::ZipArchive;

use crate::instance::constants::MODPACK_LOCK_FILE_PATH;
use crate::instance::helpers::modpack::curseforge::CurseForgeManifest;
use crate::instance::helpers::modpack::modrinth::ModrinthManifest;
use crate::instance::helpers::modpack::multimc::MultiMcManifest;
use crate::instance::models::misc::{InstanceError, ModLoader, ModLoaderType};
use crate::resource::commands::fetch_mod_loader_version_list;
use crate::resource::models::OtherResourceSource;
use crate::tasks::PTaskParam;
use crate::utils::fs::calculate_sha1;

#[async_trait]
pub trait ModpackManifest {
  fn from_archive(file: &File) -> SJMCLResult<Self>
  where
    Self: Sized;
  fn get_client_version(&self) -> SJMCLResult<String>;
  fn get_mod_loader_type_version(&self) -> SJMCLResult<(ModLoaderType, String)>;
  async fn get_meta_info(&self, app: &AppHandle) -> SJMCLResult<ModpackMetaInfo>;
  async fn get_download_params(
    &self,
    app: &AppHandle,
    instance_path: &Path,
  ) -> SJMCLResult<Vec<PTaskParam>>;
  fn get_overrides_path(&self) -> String;
  fn get_lock_info(&self) -> ModpackLockInfo;
}

type ManifestBox = Box<dyn ModpackManifest + Send + Sync>;
type Parser = Box<dyn Fn(&File) -> SJMCLResult<ManifestBox> + Send + Sync>;

fn get_parsers() -> Vec<Parser> {
  vec![
    Box::new(|f| {
      CurseForgeManifest::from_archive(f).map(|m| {
        let b: ManifestBox = Box::new(m);
        b
      })
    }),
    Box::new(|f| {
      ModrinthManifest::from_archive(f).map(|m| {
        let b: ManifestBox = Box::new(m);
        b
      })
    }),
    Box::new(|f| {
      MultiMcManifest::from_archive(f).map(|m| {
        let b: ManifestBox = Box::new(m);
        b
      })
    }),
  ]
}

impl ModLoader {
  pub async fn with_branch(&self, app: &AppHandle, mc_version: String) -> SJMCLResult<Self> {
    let version_list =
      fetch_mod_loader_version_list(app.clone(), mc_version, self.loader_type).await?;
    if let Some(version) = version_list.iter().find(|v| v.version == self.version) {
      return Ok(Self {
        branch: version.branch.clone(),
        ..self.clone()
      });
    }
    Err(InstanceError::ModLoaderVersionParseError.into())
  }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModpackMetaInfo {
  pub name: String,
  pub version: Option<String>,
  pub description: Option<String>,
  pub author: Option<String>,
  pub modpack_source: OtherResourceSource,
  pub client_version: String,
  pub mod_loader: Option<ModLoader>,
}

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ModpackManagedFileKind {
  Download,
  Override,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModpackManagedFile {
  pub path: String,
  pub sha1: Option<String>,
  pub kind: ModpackManagedFileKind,
}

pub struct ModpackLockInfo {
  pub source: OtherResourceSource,
  pub version: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModpackLock {
  pub schema_version: u32,
  pub source: OtherResourceSource,
  pub version: Option<String>,
  pub files: Vec<ModpackManagedFile>,
}

impl ModpackLock {
  pub fn save(&self, instance_path: &Path) -> SJMCLResult<()> {
    let path = instance_path.join(MODPACK_LOCK_FILE_PATH);
    if let Some(parent) = path.parent() {
      fs::create_dir_all(parent)?;
    }
    fs::write(path, serde_json::to_vec_pretty(self)?)?;
    Ok(())
  }
}

pub struct ModpackInstallPlan {
  pub download_params: Vec<PTaskParam>,
  lock_info: ModpackLockInfo,
  overrides_path: String,
}

impl ModpackInstallPlan {
  pub fn download_files(&self, instance_path: &Path) -> SJMCLResult<Vec<ModpackManagedFile>> {
    self
      .download_params
      .iter()
      .map(|param| match param {
        PTaskParam::Download(param) => Ok(ModpackManagedFile {
          path: relative_path_string(instance_path, &param.dest)?,
          sha1: param.sha1.clone(),
          kind: ModpackManagedFileKind::Download,
        }),
      })
      .collect()
  }

  pub fn create_lock(
    &self,
    instance_path: &Path,
    override_files: Vec<ModpackManagedFile>,
  ) -> SJMCLResult<ModpackLock> {
    let mut files = HashMap::new();
    for file in override_files {
      files.insert(file.path.clone(), file);
    }
    // Downloaded manifest files are applied after overrides and therefore own duplicate paths.
    for file in self.download_files(instance_path)? {
      files.insert(file.path.clone(), file);
    }
    let mut files = files.into_values().collect::<Vec<_>>();
    files.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(ModpackLock {
      schema_version: 1,
      source: self.lock_info.source.clone(),
      version: self.lock_info.version.clone(),
      files,
    })
  }
}

impl ModpackMetaInfo {
  pub async fn from_archive(app: &AppHandle, file: &File) -> SJMCLResult<Self> {
    for parser in get_parsers() {
      if let Ok(manifest) = parser(file) {
        return manifest.get_meta_info(app).await;
      }
    }

    Err(InstanceError::ModpackManifestParseError.into())
  }
}

pub async fn build_install_plan(
  app: &AppHandle,
  file: &File,
  instance_path: &Path,
) -> SJMCLResult<ModpackInstallPlan> {
  for parser in get_parsers() {
    if let Ok(manifest) = parser(file) {
      return Ok(ModpackInstallPlan {
        download_params: manifest.get_download_params(app, instance_path).await?,
        lock_info: manifest.get_lock_info(),
        overrides_path: manifest.get_overrides_path(),
      });
    }
  }

  Err(InstanceError::ModpackManifestParseError.into())
}

pub fn extract_overrides(
  file: &File,
  instance_path: &Path,
  plan: &ModpackInstallPlan,
) -> SJMCLResult<Vec<ModpackManagedFile>> {
  let overrides_path = plan.overrides_path.trim_end_matches('/');
  if overrides_path.is_empty() {
    return Ok(Vec::new());
  }
  let overrides_path = Path::new(overrides_path);
  let mut archive = ZipArchive::new(file)?;
  let mut managed_files = Vec::new();
  for i in 0..archive.len() {
    let mut file = archive.by_index(i)?;
    let path = file.mangled_name();
    let outpath = if path.starts_with(overrides_path) {
      // Remove "{overrides}/" prefix and join with instance path
      let relative_path = path
        .strip_prefix(overrides_path)
        .map_err(|_| InstanceError::InvalidSourcePath)?;
      let relative_path = relative_path
        .strip_prefix(Path::new("/"))
        .unwrap_or(relative_path);
      if relative_path.as_os_str().is_empty() {
        continue;
      }
      instance_path.join(relative_path)
    } else {
      continue;
    };

    if file.is_file() {
      // Create parent directories if they don't exist
      if let Some(p) = outpath.parent()
        && !p.exists()
      {
        fs::create_dir_all(p)?;
      }

      // Extract file
      let mut outfile = File::create(&outpath)?;
      std::io::copy(&mut file, &mut outfile)?;
      managed_files.push(ModpackManagedFile {
        path: relative_path_string(instance_path, &outpath)?,
        sha1: Some(calculate_sha1(&outpath)?),
        kind: ModpackManagedFileKind::Override,
      });
    }
  }
  Ok(managed_files)
}

fn relative_path_string(root: &Path, path: &Path) -> SJMCLResult<String> {
  let relative = path
    .strip_prefix(root)
    .map_err(|_| InstanceError::InvalidSourcePath)?;
  Ok(
    relative
      .components()
      .map(|component| component.as_os_str().to_string_lossy())
      .collect::<Vec<_>>()
      .join("/"),
  )
}
