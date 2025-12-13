use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::str::FromStr;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use zip::ZipArchive;

use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::helpers::modpack::misc::{ModpackManifest, ModpackMetaInfo};
use crate::instance::models::misc::{InstanceError, ModLoader, ModLoaderType};
use crate::resource::helpers::curseforge::misc::CurseForgeProject;
use crate::resource::models::OtherResourceSource;
use crate::tasks::download::DownloadParam;
use crate::tasks::PTaskParam;

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeModLoader {
  pub id: String,
  pub primary: bool,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeFiles {
  #[serde(rename = "projectID")]
  pub project_id: u64,
  #[serde(rename = "fileID")]
  pub file_id: u64,
  pub required: bool,
}

structstruck::strike! {
#[strikethrough[derive(Deserialize, Serialize, Debug, Clone)]]
#[strikethrough[serde(rename_all = "camelCase")]]
  pub struct CurseForgeManifest {
    pub name: String,
    pub version: String,
    pub author: String,
    pub overrides: String,
    pub minecraft: struct {
      pub version: String,
      pub mod_loaders: Vec<CurseForgeModLoader>,
    },
    pub files: Vec<CurseForgeFiles>,
  }
}

structstruck::strike! {
#[strikethrough[derive(Deserialize, Serialize, Debug, Clone)]]
#[strikethrough[serde(rename_all = "camelCase")]]
  pub struct CurseForgeFileManifest {
    pub data: struct {
      pub download_url: Option<String>,
      pub file_name: String,
      pub hashes: Option<Vec<pub struct {
        pub value: String,
        pub algo: u64,
      }>>,
    }
  }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeProjectRes {
  pub data: CurseForgeProject,
}

#[async_trait]
impl ModpackManifest for CurseForgeManifest {
  fn from_archive(file: &File) -> SJMCLResult<Self> {
    let mut archive = ZipArchive::new(file)?;
    let mut manifest_file = archive.by_name("manifest.json")?;
    let mut manifest_content = String::new();
    manifest_file.read_to_string(&mut manifest_content)?;
    let manifest: Self = serde_json::from_str(&manifest_content).inspect_err(|e| {
      eprintln!("{:?}", e);
    })?;

    Ok(manifest)
  }

  async fn get_meta_info(&self, app: &AppHandle) -> SJMCLResult<ModpackMetaInfo> {
    let client_version = self.get_client_version()?;
    let (loader_type, version) = self.get_mod_loader_type_version()?;
    Ok(ModpackMetaInfo {
      name: self.name.clone(),
      version: self.version.clone(),
      description: None,
      author: Some(self.author.clone()),
      modpack_source: OtherResourceSource::CurseForge,
      client_version: client_version.clone(),
      mod_loader: ModLoader {
        loader_type,
        version,
        ..Default::default()
      }
      .with_branch(app, client_version)
      .await?,
    })
  }

  fn get_client_version(&self) -> SJMCLResult<String> {
    Ok(self.minecraft.version.clone())
  }

  fn get_mod_loader_type_version(&self) -> SJMCLResult<(ModLoaderType, String)> {
    let loader = self
      .minecraft
      .mod_loaders
      .iter()
      .find(|l| l.primary)
      .ok_or(InstanceError::ModLoaderVersionParseError)?;

    let Some((loader_type, version)) = loader.id.split_once('-') else {
      return Err(InstanceError::ModLoaderVersionParseError.into());
    };
    Ok((
      ModLoaderType::from_str(loader_type)
        .ok()
        .ok_or(InstanceError::ModLoaderVersionParseError)?,
      version.to_string(),
    ))
  }

  async fn get_download_params(
    &self,
    app: &AppHandle,
    instance_path: &Path,
  ) -> SJMCLResult<Vec<PTaskParam>> {
    let client = app.state::<reqwest::Client>();
    let instance_path = instance_path.to_path_buf();

    let tasks = self.files.iter().map(|file| {
      let client = client.clone();
      let instance_path = instance_path.clone();
      let file_id = file.file_id;
      let project_id = file.project_id;

      async move {
        let class_id = {
          let project_resp = client
            .get(format!("https://api.curseforge.com/v1/mods/{project_id}"))
            .header("x-api-key", env!("SJMCL_CURSEFORGE_API_KEY"))
            .header("accept", "application/json")
            .send()
            .await
            .map_err(|_| InstanceError::NetworkError)?;
          let project: CurseForgeProjectRes = project_resp.json().await?;
          project.data.class_id
        };

        let file_manifest: CurseForgeFileManifest = {
          let file_resp = client
            .get(format!(
              "https://api.curseforge.com/v1/mods/{project_id}/files/{file_id}"
            ))
            .header("x-api-key", env!("SJMCL_CURSEFORGE_API_KEY"))
            .header("accept", "application/json")
            .send()
            .await
            .map_err(|_| InstanceError::NetworkError)?;

          if !file_resp.status().is_success() {
            return Err(InstanceError::NetworkError.into());
          }
          file_resp.json().await.map_err(|e| {
            eprintln!("{:?}", e);
            InstanceError::CurseForgeFileManifestParseError
          })?
        };

        let download_url = file_manifest.data.download_url.unwrap_or(format!(
          "https://edge.forgecdn.net/files/{}/{}/{}",
          file_id / 1000,
          file_id % 1000,
          urlencoding::encode(&file_manifest.data.file_name)
        ));

        let sha1 = file_manifest
          .data
          .hashes
          .as_ref()
          .and_then(|hs| hs.iter().find(|h| h.algo == 1))
          .map(|h| h.value.clone());

        let task_param = PTaskParam::Download(DownloadParam {
          src: url::Url::parse(&download_url).map_err(|_| InstanceError::InvalidSourcePath)?,
          sha1,
          dest: instance_path
            .join(match class_id {
              Some(12) => "resourcepacks",
              Some(6552) => "shaderpacks",
              _ => "mods",
            })
            .join(&file_manifest.data.file_name),
          filename: Some(file_manifest.data.file_name.clone()),
        });

        Ok::<PTaskParam, SJMCLError>(task_param)
      }
    });

    let results = futures::future::join_all(tasks).await;

    let mut task_params = Vec::new();
    for result in results {
      task_params.push(result?);
    }
    Ok(task_params)
  }

  fn get_overrides_path(&self) -> String {
    self.overrides.clone()
  }
}
