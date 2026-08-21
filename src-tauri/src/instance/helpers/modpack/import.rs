use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sjmcl_types::error::SJMCLResult;
use std::fs;
use std::fs::File;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use zip::ZipArchive;

use crate::instance::helpers::modpack::curseforge::CurseForgeManifest;
use crate::instance::helpers::modpack::modrinth::ModrinthManifest;
use crate::instance::helpers::modpack::multimc::MultiMcManifest;
use crate::instance::models::misc::{InstanceError, ModLoader, ModLoaderType};
use crate::resource::commands::fetch_mod_loader_version_list;
use crate::resource::models::OtherResourceSource;
use crate::tasks::PTaskParam;

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
  fn get_overrides_paths(&self) -> Vec<PathBuf>;
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

pub async fn get_download_params(
  app: &AppHandle,
  file: &File,
  instance_path: &Path,
) -> SJMCLResult<Vec<PTaskParam>> {
  for parser in get_parsers() {
    if let Ok(manifest) = parser(file) {
      return manifest.get_download_params(app, instance_path).await;
    }
  }

  Err(InstanceError::ModpackManifestParseError.into())
}

pub fn extract_overrides(file: &File, instance_path: &Path) -> SJMCLResult<()> {
  let get_overrides_paths = |file| {
    for parser in get_parsers() {
      if let Ok(manifest) = parser(file) {
        return Some(manifest.get_overrides_paths());
      }
    }
    None
  };
  let overrides_paths =
    get_overrides_paths(file).ok_or(InstanceError::ModpackManifestParseError)?;
  let mut archive = ZipArchive::new(file)?;
  for overrides_path in overrides_paths {
    for i in 0..archive.len() {
      let mut file = archive.by_index(i)?;
      let path = file.mangled_name();
      let Ok(relative_path) = path.strip_prefix(&overrides_path) else {
        continue;
      };
      if relative_path.as_os_str().is_empty() {
        continue;
      }
      let outpath = instance_path.join(relative_path);

      if file.is_file() {
        if let Some(p) = outpath.parent()
          && !p.exists()
        {
          fs::create_dir_all(p)?;
        }

        let mut outfile = File::create(&outpath)?;
        std::io::copy(&mut file, &mut outfile)?;
      }
    }
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use std::io::Write;

  use uuid::Uuid;
  use zip::ZipWriter;
  use zip::write::SimpleFileOptions;

  use super::*;

  #[test]
  fn applies_modrinth_client_overrides_after_common_overrides() {
    let test_root = std::env::temp_dir().join(format!("sjmcl-modpack-{}", Uuid::new_v4()));
    let archive_path = test_root.join("test.mrpack");
    let instance_path = test_root.join("instance");
    fs::create_dir_all(&instance_path).unwrap();

    let archive_file = File::create(&archive_path).unwrap();
    let mut archive = ZipWriter::new(archive_file);
    archive
      .start_file("modrinth.index.json", SimpleFileOptions::default())
      .unwrap();
    archive
      .write_all(
        br#"{"formatVersion":1,"game":"minecraft","versionId":"test","name":"test","files":[],"dependencies":{"minecraft":"1.20.1"}}"#,
      )
      .unwrap();
    archive
      .start_file("overrides/config/test.txt", SimpleFileOptions::default())
      .unwrap();
    archive.write_all(b"common").unwrap();
    archive
      .start_file(
        "client-overrides/config/test.txt",
        SimpleFileOptions::default(),
      )
      .unwrap();
    archive.write_all(b"client").unwrap();
    archive.finish().unwrap();

    let archive_file = File::open(&archive_path).unwrap();
    extract_overrides(&archive_file, &instance_path).unwrap();
    drop(archive_file);

    assert_eq!(
      fs::read(instance_path.join("config/test.txt")).unwrap(),
      b"client"
    );
    fs::remove_dir_all(test_root).unwrap();
  }
}
