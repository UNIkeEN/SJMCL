use super::misc::get_download_api;
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::models::misc::ModLoaderType;
use crate::resource::models::{ModLoaderResourceInfo, ResourceError, ResourceType, SourceType};
use serde::{Deserialize, Serialize};
use tauri_plugin_http::reqwest;

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct NeoforgeMetaItem {
  pub raw_version: String,
  pub version: String,
  pub mcversion: String,
}

pub async fn get_neoforge_meta_by_game_version(
  priority_list: &Vec<SourceType>,
  game_version: &String,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  for source_type in priority_list.iter() {
    let url = get_download_api(*source_type, ResourceType::NeoforgeMeta)?
      .join("list")?
      .join(&game_version)?;
    match reqwest::get(url).await {
      Ok(response) => {
        if response.status().is_success() {
          if let Ok(manifest) = response.json::<Vec<NeoforgeMetaItem>>().await {
            return Ok(
              manifest
                .into_iter()
                .map(|info| {
                  let stable = !info.version.ends_with("beta");
                  ModLoaderResourceInfo {
                    loader_type: ModLoaderType::NeoForge,
                    version: info.version,
                    description: String::new(),
                    stable,
                  }
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
