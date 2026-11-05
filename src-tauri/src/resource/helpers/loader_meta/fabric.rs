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
#[serde(rename_all = "camelCase")]
struct FabricMetaItem {
  pub loader: FabricLoaderInfo,
  pub intermediary: Value,
  pub launcher_meta: Value,
}

#[derive(Serialize, Deserialize, Default)]
struct FabricLoaderInfo {
  pub separator: String,
  pub build: i64,
  pub maven: String,
  pub version: String,
  pub stable: bool,
}

pub struct FabricMetaClient {
  http: Client,
}

impl FabricMetaClient {
  pub fn new(http: Client) -> Self {
    Self { http }
  }

  pub async fn fetch(
    &self,
    priority_list: &[SourceType],
    game_version: &str,
  ) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
    for source_type in priority_list.iter() {
      let url = get_download_api(*source_type, ResourceType::FabricMeta)?
        .join("v2/versions/loader/")?
        .join(game_version)?;
      match self.http.get(url).send().await {
        Ok(response) => {
          if response.status().is_success() {
            if let Ok(manifest) = response.json::<Vec<FabricMetaItem>>().await {
              return Ok(
                manifest
                  .into_iter()
                  .map(|info| ModLoaderResourceInfo {
                    loader_type: ModLoaderType::Fabric,
                    version: info.loader.version,
                    description: String::new(),
                    // stable: info.loader.stable,
                    stable: None,
                    branch: None,
                  })
                  .collect(),
              );
            } else {
              return Err(ResourceError::ParseError.into());
            }
          } else {
            continue;
          }
        }
        Err(_) => continue,
      }
    }
    Err(ResourceError::NetworkError.into())
  }
}
