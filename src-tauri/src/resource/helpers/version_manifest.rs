use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use sjmcl_types::error::SJMCLResult;
use tauri_plugin_http::reqwest::Client;

use crate::resource::{
  helpers::misc::get_download_api,
  models::{GameClientResourceInfo, ResourceError, ResourceType, SourceType},
};

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

pub struct GameVersionManifestClient {
  http: Client,
  cache_dir: Option<PathBuf>,
}

impl GameVersionManifestClient {
  pub fn new(http: Client, cache_dir: Option<PathBuf>) -> Self {
    Self { http, cache_dir }
  }

  pub async fn fetch(
    &self,
    priority_list: &[SourceType],
  ) -> SJMCLResult<Vec<GameClientResourceInfo>> {
    for source_type in priority_list.iter() {
      let url = get_download_api(*source_type, ResourceType::VersionManifest)?;
      let response = match self.http.get(url).send().await {
        Ok(resp) if resp.status().is_success() => resp,
        _ => continue,
      };

      let manifest = match response.json::<VersionManifest>().await {
        Ok(m) => m,
        Err(_) => return Err(ResourceError::ParseError.into()),
      };

      self.save_cache(&manifest.versions);
      // update list saved in cache dir, may be used in version compare.

      let game_info_list = manifest
        .versions
        .into_iter()
        .map(|info| {
          let april_fool =
            info.release_time.contains("04-01") && semver::Version::parse(&info.id).is_err();
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

  fn save_cache(&self, versions: &[GameResource]) {
    let Some(cache_dir) = self.cache_dir.as_deref() else {
      return;
    };

    if !cache_dir.exists() && fs::create_dir_all(&cache_dir).is_err() {
      return;
    }

    let content = versions
      .iter()
      .rev()
      .map(|v| v.id.as_str())
      .collect::<Vec<_>>()
      .join("\n");
    let _ = fs::write(cache_dir.join("game_versions.txt"), content);
  }
}
