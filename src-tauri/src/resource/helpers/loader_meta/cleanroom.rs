use serde::{Deserialize, Serialize};
use sjmcl_types::error::SJMCLResult;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::instance::models::misc::ModLoaderType;
use crate::resource::helpers::misc::get_download_api;
use crate::resource::models::{ModLoaderResourceInfo, ResourceError, ResourceType, SourceType};

#[derive(Serialize, Deserialize, Default)]
struct CleanroomMetaItem {
  pub name: String,
  pub created_at: String,
}

async fn get_cleanroom_meta_by_game_version_official(
  app: &AppHandle,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let client = app.state::<reqwest::Client>();
  let url = get_download_api(SourceType::Official, ResourceType::CleanroomMeta)?;
  match client.get(url).send().await {
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

pub async fn get_cleanroom_meta_by_game_version(
  app: &AppHandle,
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  if game_version != "1.12.2" {
    return Ok(Vec::new());
  }

  if let Ok(meta) = get_cleanroom_meta_by_game_version_official(app).await {
    let list = meta
      .into_iter()
      .filter(|it| {
        let parsed_cleanroom_version = semver::Version::parse(it.version.as_ref());
        let cleanroom_0_7_0_version = semver::Version::parse("0.7.0-alpha");
        return if let Ok(parsed) = parsed_cleanroom_version
          && let Ok(cleanroom_0_7_0) = cleanroom_0_7_0_version
        {
          if parsed.cmp(&cleanroom_0_7_0).is_lt() {
            true
          } else {
            false
          }
        } else {
          false
        };
      })
      .collect();

    return Ok(list);
  }

  Err(ResourceError::NetworkError.into())
}
