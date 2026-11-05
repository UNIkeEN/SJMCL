use serde::{Deserialize, Serialize};
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
struct CleanroomMetaItem {
  pub name: String,
  pub created_at: String,
}

pub struct CleanroomMetaClient {
  http: Client,
}

impl CleanroomMetaClient {
  pub fn new(http: Client) -> Self {
    Self { http }
  }

  pub async fn fetch(&self, game_version: &str) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
    if game_version != "1.12.2" {
      return Ok(Vec::new());
    }

    let url = get_download_api(SourceType::Official, ResourceType::CleanroomMeta)?;

    match self.http.get(url).send().await {
      Ok(response) => {
        if response.status().is_success() {
          if let Ok(mut manifest) = response.json::<Vec<CleanroomMetaItem>>().await {
            manifest.sort_by_key(|b| std::cmp::Reverse(b.created_at.clone()));
            Ok(
              manifest
                .into_iter()
                .map(|info| ModLoaderResourceInfo {
                  loader_type: ModLoaderType::Cleanroom,
                  version: info.name,
                  description: info.created_at,
                  stable: None,
                  branch: None,
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
