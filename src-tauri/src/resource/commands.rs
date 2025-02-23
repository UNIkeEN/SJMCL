use std::sync::Mutex;
use tauri::State;

use serde_json::Value;
use tauri_plugin_http::reqwest;

use crate::{error::SJMCLResult, launcher_config::models::LauncherConfig};

use super::{
  helpers::{get_download_api, get_source_priority_list},
  models::{GameResourceInfo, ModLoaderResourceInfo, ResourceError, ResourceType},
};

#[tauri::command]
pub async fn fetch_game_version_list(
  state: State<'_, Mutex<LauncherConfig>>,
) -> SJMCLResult<Vec<GameResourceInfo>> {
  let priority_list = {
    let state = state.lock()?;
    get_source_priority_list(&state)
  };
  for source in priority_list {
    let url = format!(
      "{}/mc/game/version_manifest.json",
      get_download_api(source, ResourceType::Game).await.unwrap()
    );
    match reqwest::get(url).await {
      Ok(response) => {
        if response.status().is_success() {
          let data = response
            .json::<Value>()
            .await
            .or(Err(ResourceError::ParseError))?;

          let versions = data["versions"]
            .as_array()
            .ok_or(ResourceError::ParseError)?;

          let mut game_version_list: Vec<GameResourceInfo> = vec![];

          for version in versions {
            let release_time = version["releaseTime"]
              .as_str()
              .ok_or(ResourceError::ParseError)?
              .to_string();

            game_version_list.push(GameResourceInfo {
              id: version["id"]
                .as_str()
                .ok_or(ResourceError::ParseError)?
                .to_string(),
              game_type: if release_time.contains("04-01") {
                "april_fools".to_string()
              } else {
                version["type"]
                  .as_str()
                  .ok_or(ResourceError::ParseError)?
                  .to_string()
              },
              release_time,
              url: version["url"]
                .as_str()
                .ok_or(ResourceError::ParseError)?
                .to_string(),
            })
          }

          return Ok(game_version_list);
        } else {
          continue;
        }
      }
      Err(_) => continue,
    }
  }
  Err(ResourceError::NoDownloadApi.into())
}

#[tauri::command]
pub async fn fetch_mod_loader_version_list(
  game_version: String,
  mod_loader_type: String,
  state: State<'_, Mutex<LauncherConfig>>,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  match mod_loader_type.as_str() {
    "Forge" => {
      const BMCL_API: &str = "https://bmclapi2.bangbang93.com";
      // we currently only have BMCLAPI2 for listing all forge versions matched the game version
      let url = format!("{}/forge/minecraft/{}", BMCL_API, game_version);
      match reqwest::get(url).await {
        Ok(response) => {
          if response.status().is_success() {
            let data = response
              .json::<Value>()
              .await
              .or(Err(ResourceError::ParseError))?;

            let versions = data.as_array().ok_or(ResourceError::ParseError)?;

            let mut mod_loader_version_list: Vec<ModLoaderResourceInfo> = vec![];

            for version in versions {
              mod_loader_version_list.push(ModLoaderResourceInfo {
                loader_type: mod_loader_type.clone(),
                version: version["version"]
                  .as_str()
                  .ok_or(ResourceError::ParseError)?
                  .to_string(),
                description: version["modified"]
                  .as_str()
                  .ok_or(ResourceError::ParseError)?
                  .to_string(),
                stable: true,
              })
            }

            Ok(mod_loader_version_list)
          } else {
            Err(ResourceError::NoDownloadApi.into())
          }
        }
        Err(_) => Err(ResourceError::NoDownloadApi.into()),
      }
    }
    "Fabric" => {
      let priority_list = {
        let state = state.lock()?;
        get_source_priority_list(&state)
      };
      for source in priority_list {
        let url = format!(
          "{}/v2/versions/loader/{}",
          get_download_api(source, ResourceType::Fabric)
            .await
            .unwrap(),
          game_version
        );
        match reqwest::get(url).await {
          Ok(response) => {
            if response.status().is_success() {
              let data = response
                .json::<Value>()
                .await
                .or(Err(ResourceError::ParseError))?;

              let versions = data.as_array().ok_or(ResourceError::ParseError)?;

              let mut mod_loader_version_list: Vec<ModLoaderResourceInfo> = vec![];

              for version in versions {
                mod_loader_version_list.push(ModLoaderResourceInfo {
                  loader_type: mod_loader_type.clone(),
                  version: version["loader"]["version"]
                    .as_str()
                    .ok_or(ResourceError::ParseError)?
                    .to_string(),
                  description: "".to_string(),
                  stable: version["loader"]["stable"]
                    .as_bool()
                    .ok_or(ResourceError::ParseError)?,
                });
              }

              return Ok(mod_loader_version_list);
            } else {
              continue;
            }
          }
          Err(_) => continue,
        }
      }
      Err(ResourceError::NoDownloadApi.into())
    }
    "NeoForge" => {
      const BMCL_API: &str = "https://bmclapi2.bangbang93.com";
      // we currently only have BMCLAPI2 for listing all forge versions matched the game version
      let url = format!("{}/neoforge/list/{}", BMCL_API, game_version);
      match reqwest::get(url).await {
        Ok(response) => {
          if response.status().is_success() {
            let data = response
              .json::<Value>()
              .await
              .or(Err(ResourceError::ParseError))?;

            let versions = data.as_array().ok_or(ResourceError::ParseError)?;

            let mut mod_loader_version_list: Vec<ModLoaderResourceInfo> = vec![];

            for v in versions {
              let version = v["version"].as_str().ok_or(ResourceError::ParseError)?;
              mod_loader_version_list.push(ModLoaderResourceInfo {
                loader_type: mod_loader_type.clone(),
                version: version.to_string(),
                description: "".to_string(),
                stable: !version.ends_with("beta"),
              })
            }

            Ok(mod_loader_version_list)
          } else {
            Err(ResourceError::NoDownloadApi.into())
          }
        }
        Err(_) => Err(ResourceError::NoDownloadApi.into()),
      }
    }
    _ => Err(ResourceError::NoDownloadApi.into()),
  }
}
