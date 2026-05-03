use crate::error::SJMCLResult;
use crate::instance::models::misc::ModLoaderType;
use crate::resource::helpers::misc::get_download_api;
use crate::resource::models::{ModLoaderResourceInfo, ResourceError, ResourceType, SourceType};
use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct QuiltMetaItem {
  pub loader: QuiltLoaderInfo,
  pub intermediary: Value,
}

#[derive(Serialize, Deserialize, Default)]
struct QuiltLoaderInfo {
  pub version: String,
}

/// Fetch Quilt loader versions for a specific Minecraft version
pub async fn get_quilt_meta_by_game_version(
  app: &AppHandle,
  priority_list: &[SourceType],
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let client = app.state::<reqwest::Client>();

  for source_type in priority_list.iter() {
    let url = get_download_api(*source_type, ResourceType::QuiltMeta)?
      .join("v3/versions/loader/")?
      .join(game_version)?;

    match client.get(url).send().await {
      Ok(response) => {
        if response.status().is_success() {
          // API response may not be in current order, sort by semver here.
          if let Ok(mut manifest) = response.json::<Vec<QuiltMetaItem>>().await {
            manifest.sort_by(|a, b| {
              match (
                Version::parse(&a.loader.version),
                Version::parse(&b.loader.version),
              ) {
                (Ok(left), Ok(right)) => right.cmp(&left),
                (Ok(_), Err(_)) => std::cmp::Ordering::Less,
                (Err(_), Ok(_)) => std::cmp::Ordering::Greater,
                (Err(_), Err(_)) => b.loader.version.cmp(&a.loader.version),
              }
            });
            return Ok(
              manifest
                .into_iter()
                .map(|info| {
                  let version = info.loader.version;
                  let stable = !version.contains("beta")
                    && !version.contains("alpha")
                    && !version.contains("rc");
                  ModLoaderResourceInfo {
                    loader_type: ModLoaderType::Quilt,
                    version,
                    description: String::new(),
                    stable,
                    branch: None,
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

  Err(ResourceError::NetworkError.into())
}
