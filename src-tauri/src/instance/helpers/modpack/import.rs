use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sjmcl_types::error::SJMCLResult;
use std::fs;
use std::fs::File;
use std::path::Path;
use tauri::AppHandle;
use zip::ZipArchive;

use crate::instance::helpers::client_json::McClientInfo;
use crate::instance::helpers::modpack::curseforge::CurseForgeManifest;
use crate::instance::helpers::modpack::modrinth::ModrinthManifest;
use crate::instance::helpers::modpack::multimc::MultiMcManifest;
use crate::instance::models::misc::{Instance, InstanceError, ModLoader, ModLoaderType};
use crate::resource::commands::fetch_mod_loader_version_list;
use crate::resource::models::OtherResourceSource;
use crate::tasks::PTaskParam;

pub struct PreparedModpack {
  pub client_info: McClientInfo,
  pub download_params: Vec<PTaskParam>,
  pub java_version: Option<String>,
}

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
  async fn prepare_instance(
    &self,
    _app: &AppHandle,
    _file: &File,
    _instance: &mut Instance,
  ) -> SJMCLResult<Option<PreparedModpack>> {
    Ok(None)
  }
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
    parse_manifest(file)?.get_meta_info(app).await
  }
}

pub fn parse_manifest(file: &File) -> SJMCLResult<ManifestBox> {
  for parser in get_parsers() {
    if let Ok(manifest) = parser(file) {
      return Ok(manifest);
    }
  }

  Err(InstanceError::ModpackManifestParseError.into())
}

pub fn extract_overrides(
  file: &File,
  instance_path: &Path,
  overrides_path: &str,
) -> SJMCLResult<()> {
  let mut archive = ZipArchive::new(file)?;
  for i in 0..archive.len() {
    let mut file = archive.by_index(i)?;
    let path = file.mangled_name();
    let outpath = if path.starts_with(format!("{}/", overrides_path)) {
      // Remove "{overrides}/" prefix and join with instance path
      let relative_path = path.strip_prefix(format!("{}/", overrides_path)).unwrap();
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
    }
  }
  Ok(())
}
