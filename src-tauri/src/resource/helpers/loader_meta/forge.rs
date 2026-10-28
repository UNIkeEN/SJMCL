use serde::{Deserialize, Serialize};
use serde_json::Value;
use sjmcl_types::error::SJMCLResult;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::instance::models::misc::ModLoaderType;
use crate::resource::helpers::misc::get_download_api;
use crate::resource::models::{ModLoaderResourceInfo, ResourceError, ResourceType, SourceType};

#[derive(Serialize, Deserialize, Default)]
struct ForgeMetaItem {
  pub branch: Option<Value>,
  pub build: i64,
  pub files: Vec<ForgeFile>,
  pub mcversion: String,
  pub modified: String,
  pub version: String,
}

#[derive(Serialize, Deserialize, Default)]
pub struct ForgeFile {
  pub format: String,
  pub category: String,
  pub hash: String,
}

async fn fetch_forge_meta_bmcl(
  app: &AppHandle,
  game_version: &str,
) -> SJMCLResult<Vec<ForgeMetaItem>> {
  let client = app.state::<reqwest::Client>();
  let url = get_download_api(SourceType::BMCLAPIMirror, ResourceType::ForgeMeta)?
    .join("minecraft/")?
    .join(game_version)?;
  match client.get(url).send().await {
    Ok(response) => {
      if response.status().is_success() {
        if let Ok(manifest) = response.json::<Vec<ForgeMetaItem>>().await {
          Ok(manifest)
        } else {
          Err(ResourceError::ParseError.into())
        }
      } else {
        Err(ResourceError::NetworkError.into())
      }
    }
    Err(_) => Err(ResourceError::NetworkError.into()),
  }
}

async fn get_forge_meta_by_game_version_bmcl(
  app: &AppHandle,
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let mut manifest = fetch_forge_meta_bmcl(app, game_version).await?;
  manifest.sort_by_key(|b| std::cmp::Reverse(b.build));
  Ok(
    manifest
      .into_iter()
      .map(|info| ModLoaderResourceInfo {
        loader_type: ModLoaderType::Forge,
        version: info.version,
        description: info.modified,
        stable: None,
        branch: info.branch.and_then(|v| v.as_str().map(String::from)),
      })
      .collect(),
  )
}

pub async fn get_legacy_forge_file(
  app: &AppHandle,
  game_version: &str,
  loader_version: &str,
) -> SJMCLResult<Option<ForgeFile>> {
  // Minecraft 1.5.2+ (Forge 7.8+) keeps the existing installer path.
  let mut version = loader_version.split('.');
  let major = version.next().and_then(|part| part.parse::<u32>().ok());
  let minor = version.next().and_then(|part| part.parse::<u32>().ok());
  if !matches!((major, minor), (Some(major), Some(minor)) if (major, minor) < (7, 8)) {
    return Ok(None);
  }

  let meta = fetch_forge_meta_bmcl(app, game_version)
    .await?
    .into_iter()
    .find(|meta| meta.version == loader_version)
    .ok_or(ResourceError::ParseError)?;
  if meta
    .files
    .iter()
    .any(|file| file.category == "installer" && file.format == "jar")
  {
    return Ok(None);
  }
  meta
    .files
    .into_iter()
    .filter(|file| file.format == "zip" && matches!(file.category.as_str(), "universal" | "client"))
    .min_by_key(|file| file.category != "universal")
    .map(Some)
    .ok_or_else(|| ResourceError::ParseError.into())
}

async fn get_forge_meta_by_game_version_official(
  app: &AppHandle,
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let _ = (app, game_version);
  Err(ResourceError::NoDownloadApi.into()) // TODO
}

pub async fn get_forge_meta_by_game_version(
  app: &AppHandle,
  priority_list: &[SourceType],
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  for source_type in priority_list.iter() {
    match *source_type {
      SourceType::BMCLAPIMirror => {
        if let Ok(meta) = get_forge_meta_by_game_version_bmcl(app, game_version).await {
          return Ok(meta);
        }
      }
      SourceType::Official => {
        if let Ok(meta) = get_forge_meta_by_game_version_official(app, game_version).await {
          return Ok(meta);
        }
      }
    }
  }
  Err(ResourceError::NetworkError.into())
}
