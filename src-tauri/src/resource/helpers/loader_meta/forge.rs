use serde::{Deserialize, Serialize};
use serde_json::Value;
use sjmcl_types::error::SJMCLResult;
use tauri_plugin_http::reqwest::Client;

use crate::{
  instance::models::misc::ModLoaderType,
  resource::{
    helpers::misc::get_download_api,
    models::{ModLoaderResourceInfo, ResourceError, ResourceType, SourceType},
  },
};

#[derive(Serialize, Deserialize, Default)]
struct ForgeMetaItem {
  pub branch: Option<Value>,
  pub build: i64,
  pub files: Vec<Value>,
  pub mcversion: String,
  pub modified: String,
  pub version: String,
}

pub struct ForgeMetaClient {
  http: Client,
}

impl ForgeMetaClient {
  pub fn new(http: Client) -> Self {
    Self { http }
  }

  pub async fn fetch(
    &self,
    priority_list: &[SourceType],
    game_version: &str,
  ) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
    for source_type in priority_list.iter() {
      match *source_type {
        SourceType::Official => {
          if let Ok(meta) = self.fetch_from_official(game_version).await {
            return Ok(meta);
          }
        }
        SourceType::BMCLAPIMirror => {
          if let Ok(meta) = self.fetch_from_bmcl(game_version).await {
            return Ok(meta);
          }
        }
      }
    }
    Err(ResourceError::NetworkError.into())
  }

  async fn fetch_from_official(
    &self,
    game_version: &str,
  ) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
    _ = game_version;
    Err(ResourceError::NoDownloadApi.into()) // TODO
  }

  async fn fetch_from_bmcl(&self, game_version: &str) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
    let url = get_download_api(SourceType::BMCLAPIMirror, ResourceType::ForgeMeta)?
      .join("minecraft/")?
      .join(game_version)?;
    match self.http.get(url).send().await {
      Ok(response) => {
        if response.status().is_success() {
          if let Ok(mut manifest) = response.json::<Vec<ForgeMetaItem>>().await {
            manifest.sort_by_key(|b| std::cmp::Reverse(b.build));
            Ok(
              manifest
                .into_iter()
                .map(|info| ModLoaderResourceInfo {
                  loader_type: ModLoaderType::Forge,
                  version: info.version,
                  description: info.modified,
                  // stable: true,
                  stable: None,
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
}
