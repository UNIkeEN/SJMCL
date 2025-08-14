use super::super::misc::get_download_api;
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::models::misc::ModLoaderType;
use crate::resource::models::{ModLoaderResourceInfo, ResourceError, ResourceType, SourceType};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

#[derive(Serialize, Deserialize, Default)]
struct ForgeMetaItem {
  pub branch: Option<Value>,
  pub build: i64,
  pub files: Vec<Value>,
  pub mcversion: String,
  pub modified: String,
  pub version: String,
}

async fn get_forge_meta_by_game_version_bmcl(
  app: &AppHandle,
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let client = app.state::<reqwest::Client>();
  let url = get_download_api(SourceType::BMCLAPIMirror, ResourceType::ForgeMeta)?
    .join("minecraft/")?
    .join(game_version)?;
  match client.get(url).send().await {
    Ok(response) => {
      if response.status().is_success() {
        if let Ok(mut manifest) = response.json::<Vec<ForgeMetaItem>>().await {
          manifest.sort_by(|a, b| b.build.cmp(&a.build));
          Ok(
            manifest
              .into_iter()
              .map(|info| ModLoaderResourceInfo {
                loader_type: ModLoaderType::Forge,
                version: info.version,
                description: info.modified,
                stable: true,
                branch: info.branch.and_then(|v| v.as_str().map(String::from)),
              })
              .collect(),
          )
        } else {
          Err(ResourceError::ParseError.into())
        }
      } else {
        Err(ResourceError::NetworkError.into())
      }
    }
    Err(_) => Err(ResourceError::NetworkError.into()),
  }
}

async fn get_forge_meta_by_game_version_official(
  app: &AppHandle,
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  Err(ResourceError::NoDownloadApi.into()) // TODO
}

pub async fn get_forge_meta_by_game_version(
  app: &AppHandle,
  priority_list: &[SourceType],
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  for source_type in priority_list.iter() {
    match *source_type {
      SourceType::BMCLAPIMirror => {
        if let Ok(meta) = get_forge_meta_by_game_version_bmcl(app, game_version).await {
          return Ok(meta);
        }
      }
      SourceType::Official => {
        if let Ok(meta) = get_forge_meta_by_game_version_official(app, game_version).await {
          return Ok(meta);
        }
      }
    }
  }
  Err(SJMCLError(String::new()))
}
