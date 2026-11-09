use semver::Version;
use serde::{Deserialize, Serialize};
use sjmcl_types::error::SJMCLResult;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::instance::models::misc::ModLoaderType;
use crate::resource::helpers::loader_meta::misc::{
  fetch_loader_versions_with_fallback, fetch_meta_game_versions,
};
use crate::resource::helpers::misc::get_download_api;
use crate::resource::models::{ModLoaderResourceInfo, ResourceError, ResourceType, SourceType};

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

async fn fetch_quilt_loader_versions(
  client: &reqwest::Client,
  source_type: SourceType,
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let url = get_download_api(source_type, ResourceType::QuiltMeta)?
    .join("v3/versions/loader/")?
    .join(game_version)?;
  let response = client
    .get(url)
    .send()
    .await
    .map_err(|_| ResourceError::NetworkError)?;
  if !response.status().is_success() {
    return Err(ResourceError::NetworkError.into());
  }

  let mut manifest = response
    .json::<Vec<QuiltMetaItem>>()
    .await
    .map_err(|_| ResourceError::ParseError)?;
  // API response may not be in current order, sort by semver here.
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
  Ok(
    manifest
      .into_iter()
      .map(|info| {
        let version = info.loader.version;
        let stable =
          !version.contains("beta") && !version.contains("alpha") && !version.contains("rc");
        ModLoaderResourceInfo {
          loader_type: ModLoaderType::Quilt,
          version,
          description: String::new(),
          stable: Some(stable),
          branch: None,
        }
      })
      .collect(),
  )
}

/// Fetch Quilt loader versions for a specific Minecraft version
pub async fn get_quilt_meta_by_game_version(
  app: &AppHandle,
  priority_list: &[SourceType],
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let client = app.state::<reqwest::Client>();
  let client = client.inner();

  fetch_loader_versions_with_fallback(
    priority_list,
    game_version,
    |source_type| fetch_quilt_loader_versions(client, source_type, game_version),
    |source_type| async move {
      // The game version list of BMCLAPI is outdated (latest is 23w51b), so it can't tell
      // whether a game version is supported.
      if source_type == SourceType::BMCLAPIMirror {
        return Err(ResourceError::NoDownloadApi.into());
      }
      let url = get_download_api(source_type, ResourceType::QuiltMeta)?.join("v3/versions/game")?;
      fetch_meta_game_versions(client, url).await
    },
  )
  .await
}
