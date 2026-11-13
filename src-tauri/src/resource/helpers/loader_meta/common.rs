use std::future::Future;

use serde::{Deserialize, Serialize};
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use tauri_plugin_http::reqwest::{self, Url};

use crate::resource::models::{ResourceError, SourceType};

#[derive(Serialize, Deserialize, Default)]
struct MetaGameVersionItem {
  pub version: String,
}

/// Fetch the game versions listed by a Fabric or Quilt meta API (`versions/game`).
pub async fn fetch_meta_game_versions(
  client: &reqwest::Client,
  url: Url,
) -> SJMCLResult<Vec<String>> {
  let response = client
    .get(url)
    .send()
    .await
    .map_err(|_| ResourceError::NetworkError)?;
  if !response.status().is_success() {
    return Err(ResourceError::NetworkError.into());
  }

  let items = response
    .json::<Vec<MetaGameVersionItem>>()
    .await
    .map_err(|_| ResourceError::ParseError)?;
  Ok(items.into_iter().map(|item| item.version).collect())
}

/// Fetch loader versions for a game version from the sources in priority order.
/// Designed for Fabric and Quilt, whose meta APIs respond with an error instead of an empty list
/// for unsupported game versions.
///
/// - Returns the loader versions of the first source that succeeds.
/// - If a source fails, checks its game version list to see if the game version is supported.
/// - Returns an empty list if all sources fail and a fetched game version list lacks the version.
/// - Otherwise returns the last error.
pub async fn fetch_loader_versions_with_fallback<T, L, LF, G, GF>(
  priority_list: &[SourceType],
  game_version: &str,
  fetch_loader_versions: L,
  fetch_game_versions: G,
) -> SJMCLResult<Vec<T>>
where
  L: Fn(SourceType) -> LF,
  LF: Future<Output = SJMCLResult<Vec<T>>>,
  G: Fn(SourceType) -> GF,
  GF: Future<Output = SJMCLResult<Vec<String>>>,
{
  let mut version_unsupported = false;
  let mut last_error: Option<SJMCLError> = None;

  for source_type in priority_list.iter().copied() {
    match fetch_loader_versions(source_type).await {
      Ok(loader_versions) => return Ok(loader_versions),
      Err(e) => {
        if !version_unsupported && let Ok(game_versions) = fetch_game_versions(source_type).await {
          version_unsupported = !game_versions.iter().any(|version| version == game_version);
        }
        last_error = Some(e);
      }
    }
  }

  if version_unsupported {
    return Ok(Vec::new());
  }

  Err(last_error.unwrap_or_else(|| ResourceError::NetworkError.into()))
}
