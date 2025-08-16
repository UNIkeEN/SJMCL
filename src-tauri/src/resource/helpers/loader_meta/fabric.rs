use super::super::misc::get_download_api;
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::models::misc::ModLoaderType;
use crate::resource::models::{ModLoaderResourceInfo, ResourceError, ResourceType, SourceType};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

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

pub async fn get_fabric_meta_by_game_version(
  app: &AppHandle,
  priority_list: &[SourceType],
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let client = app.state::<reqwest::Client>();
  for source_type in priority_list.iter() {
    let url = get_download_api(*source_type, ResourceType::FabricMeta)?
      .join("v2/versions/loader/")?
      .join(game_version)?;
    match client.get(url).send().await {
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
                  stable: info.loader.stable,
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
  Err(SJMCLError(String::new()))
}
