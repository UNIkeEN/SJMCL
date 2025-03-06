use super::misc::get_download_api;
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::models::misc::ModLoaderType;
use crate::resource::models::{ModLoaderResourceInfo, ResourceError, ResourceType, SourceType};
use serde::{Deserialize, Serialize};
use serde_json::Value;
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

pub async fn get_forge_meta_by_game_version(
  priority_list: &Vec<SourceType>,
  game_version: &String,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  for source_type in priority_list.iter() {
    let url = get_download_api(*source_type, ResourceType::ForgeMeta)?
      .join("minecraft")?
      .join(game_version)?;
    match reqwest::get(url).await {
      Ok(response) => {
        if response.status().is_success() {
          if let Ok(manifest) = response.json::<Vec<ForgeMetaItem>>().await {
            return Ok(
              manifest
                .into_iter()
                .map(|info| ModLoaderResourceInfo {
                  loader_type: ModLoaderType::Forge,
                  version: info.version,
                  description: info.modified,
                  stable: true,
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
