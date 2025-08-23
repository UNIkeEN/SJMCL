use std::{
  fs::{self, File},
  io::Read,
  path::Path,
  str::FromStr,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use zip::ZipArchive;

use crate::{
  error::{SJMCLError, SJMCLResult},
  instance::models::misc::{InstanceError, ModLoaderType},
  resource::helpers::curseforge::misc::CurseForgeProject,
  tasks::{download::DownloadParam, RuntimeTaskParam},
};

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

impl CurseForgeManifest {
  pub fn from_archive(file: &File) -> SJMCLResult<Self> {
    let mut archive = ZipArchive::new(file)?;
    let mut manifest_file = archive.by_name("manifest.json")?;
    let mut manifest_content = String::new();
    manifest_file.read_to_string(&mut manifest_content)?;
    let manifest: Self = serde_json::from_str(&manifest_content).inspect_err(|e| {
      eprintln!("{:?}", e);
    })?;

    Ok(manifest)
  }

  pub fn get_client_version(&self) -> String {
    self.minecraft.version.clone()
  }

  pub fn get_mod_loader_type_version(&self) -> (ModLoaderType, String) {
    for loader in self.minecraft.mod_loaders.clone() {
      if loader.primary {
        let parsed = loader.id.split("-").collect::<Vec<_>>();
        let [loader, version] = parsed.as_slice() else {
          return (ModLoaderType::Unknown, String::new());
        };
        return (
          ModLoaderType::from_str(loader).unwrap_or_default(),
          version.to_string(),
        );
      }
    }
    (ModLoaderType::Unknown, String::new())
  }

  pub fn extract_overrides(&self, file: &File, instance_path: &Path) -> SJMCLResult<()> {
    let mut archive = ZipArchive::new(file)?;
    for i in 0..archive.len() {
      let mut file = archive.by_index(i)?;
      let outpath = match file.enclosed_name() {
        Some(path) => {
          if path.starts_with(format!("{}/", self.overrides)) {
            // Remove "{overrides}/" prefix and join with instance path
            let relative_path = path.strip_prefix(format!("{}/", self.overrides)).unwrap();
            instance_path.join(relative_path)
          } else {
            continue;
          }
        }
        None => continue,
      };

      if file.is_file() {
        // Create parent directories if they don't exist
        if let Some(p) = outpath.parent() {
          if !p.exists() {
            fs::create_dir_all(p)?;
          }
        }

        // Extract file
        let mut outfile = File::create(&outpath)?;
        std::io::copy(&mut file, &mut outfile)?;
      }
    }
    Ok(())
  }

  pub async fn get_download_params(
    &self,
    app: &AppHandle,
    instance_path: &Path,
  ) -> SJMCLResult<Vec<RuntimeTaskParam>> {
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

        let task_param = RuntimeTaskParam::Download(DownloadParam {
          src: url::Url::parse(&download_url).map_err(|_| InstanceError::InvalidSourcePath)?,
          sha1,
          dest: instance_path
            .join(match class_id {
              12 => "resourcepacks",
              6552 => "shaderpacks",
              _ => "mods",
            })
            .join(&file_manifest.data.file_name),
          filename: Some(file_manifest.data.file_name.clone()),
        });

        Ok::<RuntimeTaskParam, SJMCLError>(task_param)
      }
    });

    let results = futures::future::join_all(tasks).await;

    let mut task_params = Vec::new();
    for result in results {
      task_params.push(result?);
    }
    Ok(task_params)
  }
}
