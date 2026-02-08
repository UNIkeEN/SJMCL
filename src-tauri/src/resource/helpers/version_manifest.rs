use crate::error::SJMCLResult;
use crate::resource::helpers::misc::get_download_api;
use crate::resource::models::{GameClientResourceInfo, ResourceError, ResourceType, SourceType};
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use url::Url;

#[derive(Serialize, Deserialize, Default)]
struct VersionManifest {
  #[serde(default)]
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

    let unlisted_url = Url::parse(
      "https://alist.8mi.tech/d/mirror/unlisted-versions-of-minecraft/Auto/version_manifest.json",
    )
    .or_else(|_| {
      Url::parse("https://zkitefly.github.io/unlisted-versions-of-minecraft/version_manifest.json")
    })?;
    let unlisted_response = client.get(unlisted_url).send().await?;
    let unlisted_manifest = unlisted_response.json::<VersionManifest>().await?;

    let merged_manifest = merge_manifests(manifest, unlisted_manifest);

    save_version_list_to_cache(app, &merged_manifest.versions);
    // update list saved in cache dir, may be used in version compare.

    let game_info_list = merged_manifest
      .versions
      .into_iter()
      .map(|info| {
        let april_fool = info.release_time.contains("04-01") || info.id.contains("point");
        GameClientResourceInfo {
          id: info.id,
          game_type: if april_fool {
            "april_fools".to_string()
          } else if info.game_type == "pending" {
            "snapshot".to_string()
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

fn merge_manifests(a: VersionManifest, b: VersionManifest) -> VersionManifest {
  let mut versions = a.versions;
  versions.extend(b.versions);

  versions.sort_by(|x, y| y.release_time.cmp(&x.release_time));

  VersionManifest {
    latest: a.latest,
    versions,
  }
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
