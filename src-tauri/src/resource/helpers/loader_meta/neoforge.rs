use super::super::misc::get_download_api;
use crate::error::SJMCLResult;
use crate::instance::models::misc::ModLoaderType;
use crate::resource::models::{ModLoaderResourceInfo, ResourceError, ResourceType, SourceType};
use lazy_static::lazy_static;
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct NeoforgeMetaItem {
  pub raw_version: String,
  pub version: String,
  pub mcversion: String,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct NeoforgeVersions {
  pub is_snapshot: bool,
  pub versions: Vec<String>,
}

// https://github.com/HMCL-dev/HMCL/blob/efd088e014bf1c113f7b3fdf73fb983087ae3f5e/HMCLCore/src/main/java/org/jackhuang/hmcl/download/neoforge/NeoForgeOfficialVersionList.java
async fn get_neoforge_meta_by_game_version_official(
  app: &AppHandle,
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  lazy_static! {
    static ref OLD_VERSION_REGEX: Regex =
      RegexBuilder::new(r"^(?:1\.20\.1\-)?(\d+)\.(\d+)\.(\d+)$")
        .build()
        .unwrap();
    static ref NEW_VERSION_REGEX: Regex = RegexBuilder::new(r"^(\d+)\.(\d+)\.(\d+)(-beta)?$")
      .build()
      .unwrap();
  };
  let client = app.state::<reqwest::Client>();
  if game_version == "1.20.1" {
    let old_url = get_download_api(SourceType::Official, ResourceType::NeoforgeMetaForge)?;
    if let Ok(response) = client.get(old_url).send().await {
      if response.status().is_success() {
        match response.json::<NeoforgeVersions>().await {
          Ok(versions) => {
            let mut results = Vec::new();
            for version in versions.versions.into_iter() {
              if let Some(cap) = OLD_VERSION_REGEX.captures(&version) {
                let sort_key = (
                  cap[1].parse::<i32>()?,
                  cap[2].parse::<i32>()?,
                  cap[3].parse::<i32>()?,
                );
                results.push((
                  sort_key,
                  ModLoaderResourceInfo {
                    loader_type: ModLoaderType::NeoForge,
                    version,
                    description: String::new(),
                    stable: !versions.is_snapshot,
                    branch: None,
                  },
                ));
              }
            }
            results.sort_by(|a, b| b.0.cmp(&a.0));
            Ok(results.into_iter().map(|r| r.1).collect())
          }
          Err(_) => Err(ResourceError::ParseError.into()),
        }
      } else {
        Err(ResourceError::NetworkError.into())
      }
    } else {
      Err(ResourceError::NetworkError.into())
    }
  } else {
    let new_url = get_download_api(SourceType::Official, ResourceType::NeoforgeMetaNeoforge)?;
    if let Ok(response) = client.get(new_url).send().await {
      if response.status().is_success() {
        match response.json::<NeoforgeVersions>().await {
          Ok(versions) => {
            let mut results: Vec<(i32, ModLoaderResourceInfo)> = Vec::new();
            for version in versions.versions.into_iter() {
              if let Some(cap) = NEW_VERSION_REGEX.captures(&version.clone()) {
                if *game_version
                  == format!("1.{}.{}", cap[1].parse::<i32>()?, cap[2].parse::<i32>()?)
                {
                  results.push((
                    cap[3].parse::<i32>()?,
                    ModLoaderResourceInfo {
                      loader_type: ModLoaderType::NeoForge,
                      version,
                      description: String::new(),
                      stable: cap.get(4).is_none(),
                      branch: None,
                    },
                  ));
                }
              }
            }
            results.sort_by(|a, b| b.0.cmp(&a.0));
            Ok(results.into_iter().map(|r| r.1).collect())
          }
          Err(_) => Err(ResourceError::ParseError.into()),
        }
      } else {
        Err(ResourceError::NetworkError.into())
      }
    } else {
      Err(ResourceError::NetworkError.into())
    }
  }
}

async fn get_neoforge_meta_by_game_version_bmcl(
  app: &AppHandle,
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let client = app.state::<reqwest::Client>();
  let url = get_download_api(
    SourceType::BMCLAPIMirror,
    ResourceType::NeoforgeMetaNeoforge,
  )?
  .join("list/")?
  .join(game_version)?;
  match client.get(url).send().await {
    Ok(response) => {
      if response.status().is_success() {
        if let Ok(mut manifest) = response.json::<Vec<NeoforgeMetaItem>>().await {
          manifest.sort_by(|a, b| {
            let parse_version = |v: &str| {
              let stripped = if game_version == "1.20.1" {
                v.strip_prefix("1.20.1-").unwrap_or(v)
              } else {
                v
              };
              stripped
                .split('.')
                .flat_map(|part| part.split('-'))
                .map(|s| s.parse::<i32>().unwrap_or(0))
                .collect::<Vec<_>>()
            };
            parse_version(&b.version).cmp(&parse_version(&a.version))
          });
          Ok(
            manifest
              .into_iter()
              .map(|info| {
                let stable = !info.version.ends_with("beta");
                ModLoaderResourceInfo {
                  loader_type: ModLoaderType::NeoForge,
                  version: info.version,
                  description: String::new(),
                  stable,
                  branch: None,
                }
              })
              .collect(),
          )
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

pub async fn get_neoforge_meta_by_game_version(
  app: &AppHandle,
  priority_list: &[SourceType],
  game_version: &str,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  for source_type in priority_list.iter() {
    match *source_type {
      SourceType::Official => {
        if let Ok(meta) = get_neoforge_meta_by_game_version_official(app, game_version).await {
          return Ok(meta);
        }
      }
      SourceType::BMCLAPIMirror => {
        if let Ok(meta) = get_neoforge_meta_by_game_version_bmcl(app, game_version).await {
          return Ok(meta);
        }
      }
    }
    println!("{:?} failed, fallback", source_type);
  }
  Err(ResourceError::NetworkError.into())
}
