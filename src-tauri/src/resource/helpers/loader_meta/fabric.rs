use serde::{Deserialize, Serialize};
use serde_json::Value;
use sjmcl_types::error::SJMCLResult;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::instance::models::misc::ModLoaderType;
use crate::resource::helpers::loader_meta::common::{
  fetch_loader_versions_with_fallback, fetch_meta_game_versions,
};
use crate::resource::helpers::misc::get_download_api;
use crate::resource::models::{ModLoaderResourceInfo, ResourceError, ResourceType, SourceType};

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct FabricMetaItem {
  pub loader: FabricLoaderInfo,
  pub intermediary: Value,
  pub launcher_meta: Value,
}

#[derive(Serialize, Deserialize, Default)]
struct FabricLoaderInfo {
  pub separator: String,
  pub build: i64,
  pub maven: String,
  pub version: String,
  pub stable: bool,
}

async fn fetch_fabric_loader_versions(
  client: &reqwest::Client,
  source_type: SourceType,
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let url = get_download_api(source_type, ResourceType::FabricMeta)?
    .join("v2/versions/loader/")?
    .join(game_version)?;
  let response = client
    .get(url)
    .send()
    .await
    .map_err(|_| ResourceError::NetworkError)?;
  if !response.status().is_success() {
    return Err(ResourceError::NetworkError.into());
  }

  let manifest = response
    .json::<Vec<FabricMetaItem>>()
    .await
    .map_err(|_| ResourceError::ParseError)?;
  Ok(
    manifest
      .into_iter()
      .map(|info| ModLoaderResourceInfo {
        loader_type: ModLoaderType::Fabric,
        version: info.loader.version,
        description: String::new(),
        // stable: info.loader.stable,
        stable: None,
        branch: None,
      })
      .collect(),
  )
}

pub async fn get_fabric_meta_by_game_version(
  app: &AppHandle,
  priority_list: &[SourceType],
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let client = app.state::<reqwest::Client>();
  let client = client.inner();

  fetch_loader_versions_with_fallback(
    priority_list,
    game_version,
    |source_type| fetch_fabric_loader_versions(client, source_type, game_version),
    |source_type| async move {
      let url =
        get_download_api(source_type, ResourceType::FabricMeta)?.join("v2/versions/game")?;
      fetch_meta_game_versions(client, url).await
    },
  )
  .await
}
