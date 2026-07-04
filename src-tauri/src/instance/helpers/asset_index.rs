use serde::{Deserialize, Serialize};
use sjmcl_types::error::SJMCLResult;
use sjmcl_types::storage::{load_json_async, save_json_async};
use std::collections::HashMap;
use std::path::Path;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::instance::models::misc::InstanceError;

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(default)]
pub struct AssetIndex {
  pub objects: HashMap<String, AssetIndexItem>,
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(default)]
pub struct AssetIndexItem {
  pub hash: String,
  pub size: i64,
}

pub async fn load_asset_index(
  app: &AppHandle,
  asset_index_path: &Path,
  asset_index_url: &str,
) -> SJMCLResult<AssetIndex> {
  if asset_index_path.exists() {
    let asset_index = load_json_async::<AssetIndex>(asset_index_path)
      .await
      .map_err(|_| InstanceError::AssetIndexParseError)?;

    Ok(asset_index)
  } else {
    let client = app.state::<reqwest::Client>().clone();

    let asset_index = client
      .get(asset_index_url)
      .send()
      .await
      .map_err(|_| InstanceError::NetworkError)?
      .json::<AssetIndex>()
      .await
      .map_err(|_| InstanceError::AssetIndexParseError)?;

    save_json_async(&asset_index, asset_index_path).await?;

    Ok(asset_index)
  }
}
