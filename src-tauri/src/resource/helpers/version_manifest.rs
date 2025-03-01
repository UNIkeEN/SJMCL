use crate::error::SJMCLError;
use crate::resource::models::{ResourceError, ResourceType, SourceType};
use crate::{error::SJMCLResult, resource::models::GameResourceInfo};
use serde::{Deserialize, Serialize};
use tauri_plugin_http::reqwest;

use super::misc::get_download_api;

#[derive(Serialize, Deserialize, Default)]
struct VersionManifest {
  pub latest: LatestVersion,
  pub versions: Vec<GameResourceInfo>,
}

#[derive(Serialize, Deserialize, Default)]
struct LatestVersion {
  pub release: String,
  pub snapshot: String,
}

pub async fn get_latest_version(
  priority_list: &Vec<SourceType>,
) -> SJMCLResult<Vec<GameResourceInfo>> {
  for source_type in priority_list.iter() {
    let url = get_download_api(*source_type, ResourceType::VersionManifest)?;
    match reqwest::get(url).await {
      Ok(response) => {
        if response.status().is_success() {
          if let Ok(manifest) = response.json::<VersionManifest>().await {
            return Ok(manifest.versions);
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
