use crate::error::SJMCLResult;
use crate::resource::helpers::misc::get_download_api;
use crate::resource::models::{OptiFineResourceInfo, ResourceError, ResourceType, SourceType};
use tauri::Manager;
use tauri_plugin_http::reqwest;

fn get_optifine_sort_key(info: &OptiFineResourceInfo) -> (u32, u32, u32) {
  let Some((_, suffix)) = info.filename.rsplit_once("_HD_U_") else {
    return (0, 0, 0);
  };
  let suffix = suffix.trim_end_matches(".jar");
  let (version, pre) = match suffix.split_once("_pre") {
    Some((version, pre)) => (version, pre.parse().unwrap_or(0)),
    None => (suffix, u32::MAX),
  };
  let mut chars = version.chars();
  let prefix = chars
    .next()
    .map(|ch| ch.to_ascii_uppercase() as u32)
    .unwrap_or(0);
  let series = chars.as_str().parse().unwrap_or(0);
  (prefix, series, pre)
}

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
        let mut manifest = response
          .json::<Vec<OptiFineResourceInfo>>()
          .await
          .map_err(|_| ResourceError::ParseError)?;
        manifest.sort_by(|a, b| {
          get_optifine_sort_key(b)
            .cmp(&get_optifine_sort_key(a))
            .then_with(|| b.filename.cmp(&a.filename))
        });
        Ok(manifest)
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
  Err(ResourceError::NetworkError.into())
}
