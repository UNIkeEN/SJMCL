use crate::error::SJMCLError;
use crate::resource::models::{ResourceError, ResourceType, SourceType};
use crate::{error::SJMCLResult, resource::models::GameResourceInfo};
use serde::{Deserialize, Serialize};
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
  priority_list: &[SourceType],
) -> SJMCLResult<Vec<GameResourceInfo>> {
  println!("INTO get_game_version_list");
  for source_type in priority_list.iter() {
    let url = get_download_api(*source_type, ResourceType::VersionManifest)?;
    println!("{}", url);
    match reqwest::get(url).await {
      Ok(response) => {
        println!("Ok response");
        if response.status().is_success() {
          println!("is_success");
          match response.json::<VersionManifest>().await {
            Ok(manifest) => {
              println!("{:?}", manifest.versions);
              return Ok(
                manifest
                  .versions
                  .into_iter()
                  .map(|info| {
                    let april_fool = info.release_time.contains("04-01");
                    GameResourceInfo {
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
                  .collect(),
              );
            }
            Err(e) => {
              println!("parse error, {:?}", e);
              return Err(ResourceError::ParseError.into());
            }
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
