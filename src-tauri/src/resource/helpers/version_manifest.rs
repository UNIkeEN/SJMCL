use crate::error::SJMCLResult;
use crate::resource::models::{GameClientResourceInfo, ResourceError, ResourceType, SourceType};
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use super::misc::get_download_api;

#[derive(Serialize, Deserialize, Default)]
struct VersionManifest {
  pub latest: LatestVersion,
  pub versions: Vec<GameResource>,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GameResource {
  pub id: String,
  #[serde(rename = "type")]
  pub game_type: String,
  pub release_time: String,
  pub time: String,
  pub url: String,
}

#[derive(Serialize, Deserialize, Default)]
struct LatestVersion {
  pub release: String,
  pub snapshot: String,
}

pub async fn get_game_version_manifest(
  app: &AppHandle,
  priority_list: &[SourceType],
) -> SJMCLResult<Vec<GameClientResourceInfo>> {
  let client = app.state::<reqwest::Client>();

  for source_type in priority_list.iter() {
    let url = get_download_api(*source_type, ResourceType::VersionManifest)?;
    let response = match client.get(url).send().await {
      Ok(resp) if resp.status().is_success() => resp,
      _ => continue,
    };

    let manifest = match response.json::<VersionManifest>().await {
      Ok(m) => m,
      Err(_) => return Err(ResourceError::ParseError.into()),
    };

    save_version_list_to_cache(app, &manifest.versions);
    // update list saved in cache dir, may be used in version compare.

    let game_info_list = manifest
      .versions
      .into_iter()
      .map(|info| {
        let april_fool = info.release_time.contains("04-01");
        GameClientResourceInfo {
          id: info.id,
          game_type: if april_fool {
            "april_fools".to_string()
          } else {
            info.game_type
          },
          release_time: info.release_time,
          url: info.url,
        }
      })
      .collect();

    return Ok(game_info_list);
  }

  Err(ResourceError::NetworkError.into())
}

fn save_version_list_to_cache(app: &AppHandle, versions: &[GameResource]) {
  let cache_dir = match app.path().app_cache_dir().ok() {
    Some(dir) => dir,
    None => return,
  };

  if !cache_dir.exists() && fs::create_dir_all(&cache_dir).is_err() {
    return;
  }

  let file_path = cache_dir.join("game_versions.txt");
  let mut ids: Vec<String> = versions.iter().map(|v| v.id.clone()).collect();
  ids.reverse(); // reverse order

  let content = ids.join("\n");
  let _ = fs::write(file_path, content);
}
