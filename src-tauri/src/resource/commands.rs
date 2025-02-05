use serde_json::Value;
use tauri_plugin_http::reqwest;

use crate::error::SJMCLResult;

use super::{
  helpers::{get_download_api, get_source_priority_list},
  models::{GameResourceInfo, ResourceError, ResourceType},
};

#[tauri::command]
pub async fn retrive_game_version_list() -> SJMCLResult<Vec<GameResourceInfo>> {
  let priority_list = get_source_priority_list();
  for source in priority_list {
    let url = format!(
      "{}/mc/game/version_manifest.json",
      get_download_api(source, ResourceType::Game).await.unwrap()
    );
    match reqwest::get(url).await {
      Ok(response) => {
        if response.status().is_success() {
          match response.json::<Value>().await {
            Ok(data) => {
              let versions = data["versions"].as_array().unwrap();
              let mut game_version_list: Vec<GameResourceInfo> = vec![];
              for version in versions {
                let release_time = version["releaseTime"]
                  .as_str()
                  .ok_or_else(|| ResourceError::ParseError)?
                  .to_string();
                game_version_list.push(GameResourceInfo {
                  id: version["id"]
                    .as_str()
                    .ok_or_else(|| ResourceError::ParseError)?
                    .to_string(),
                  game_type: if release_time.find("04-01").is_some() {
                    "april_fools".to_string()
                  } else {
                    version["type"]
                      .as_str()
                      .ok_or_else(|| ResourceError::ParseError)?
                      .to_string()
                  },
                  release_time,
                  url: version["url"]
                    .as_str()
                    .ok_or_else(|| ResourceError::ParseError)?
                    .to_string(),
                })
              }
              return Ok(game_version_list);
            }
            Err(_) => continue,
          }
        } else {
          continue;
        }
      }
      Err(_) => continue,
    }
  }
  return Err(ResourceError::NoDownloadApi.into());
}
