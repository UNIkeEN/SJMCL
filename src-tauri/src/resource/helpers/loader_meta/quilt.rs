use semver::Version;
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
#[serde(rename_all = "camelCase")]
struct QuiltMetaItem {
  pub loader: QuiltLoaderInfo,
  // Quilt Meta may omit `intermediary` for Minecraft 26.1+ (#1937).
  // pub intermediary: serde_json::Value,
}

#[derive(Serialize, Deserialize, Default)]
struct QuiltLoaderInfo {
  pub version: String,
}

pub struct QuiltMetaClient {
  http: Client,
}

impl QuiltMetaClient {
  pub fn new(http: Client) -> Self {
    Self { http }
  }

  pub async fn fetch(
    &self,
    priority_list: &[SourceType],
    game_version: &str,
  ) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
    for source_type in priority_list.iter() {
      let url = get_download_api(*source_type, ResourceType::QuiltMeta)?
        .join("v3/versions/loader/")?
        .join(game_version)?;

      match self.http.get(url).send().await {
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
                      stable: Some(stable),
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
}
