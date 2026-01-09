use crate::error::SJMCLResult;
use crate::resource::helpers::misc::get_download_api;
use crate::resource::models::{OptiFineResourceInfo, ResourceError, ResourceType, SourceType};
use tauri::Manager;
use tauri_plugin_http::reqwest;

async fn get_optifine_meta_by_game_version_bmcl(
  app: &tauri::AppHandle,
  game_version: &str,
) -> SJMCLResult<Vec<OptiFineResourceInfo>> {
  let client = app.state::<reqwest::Client>();
  let url =
    get_download_api(SourceType::BMCLAPIMirror, ResourceType::OptiFine)?.join(game_version)?;
  match client.get(url).send().await {
    Ok(response) => {
      if response.status().is_success() {
        response
          .json::<Vec<OptiFineResourceInfo>>()
          .await
          .map_err(|_| ResourceError::ParseError.into())
      } else {
        Err(ResourceError::NetworkError.into())
      }
    }
    Err(_) => Err(ResourceError::NetworkError.into()),
  }
}

pub async fn get_optifine_meta_by_game_version(
  app: &tauri::AppHandle,
  priority_list: &[SourceType],
  game_version: &str,
) -> SJMCLResult<Vec<OptiFineResourceInfo>> {
  for source_type in priority_list.iter() {
    match source_type {
      SourceType::BMCLAPIMirror => {
        return get_optifine_meta_by_game_version_bmcl(app, game_version).await;
      }
      _ => continue,
    }
  }
  Err(ResourceError::NoDownloadApi.into())
}
