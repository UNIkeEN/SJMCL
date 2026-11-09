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

/// Fetch loader versions for a game version, trying the sources in priority order.
///
/// Fabric and Quilt meta respond with an error status instead of an empty list if the game
/// version is not supported, and mirrors may fail for supported versions as well. So if a
/// source fails to return loader versions, its game version list decides whether the game
/// version is supported. If no source returns loader versions and a successfully fetched game
/// version list does not contain the game version, an empty list is returned. The remaining
/// sources are still tried first, so a mirror that has not synced a new game version yet does not
/// hide loader versions available from other sources.
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

#[cfg(test)]
mod tests {
  use std::cell::Cell;

  use futures::executor::block_on;
  use futures::future::{Ready, ready};
  use sjmcl_types::error::SJMCLResult;

  use crate::resource::helpers::loader_meta::misc::fetch_loader_versions_with_fallback;
  use crate::resource::models::{ResourceError, SourceType};

  const SOURCES: [SourceType; 2] = [SourceType::Official, SourceType::BMCLAPIMirror];

  fn network_error<T>() -> Ready<SJMCLResult<T>> {
    ready(Err(ResourceError::NetworkError.into()))
  }

  fn game_versions(versions: &[&str]) -> Ready<SJMCLResult<Vec<String>>> {
    ready(Ok(versions.iter().map(|v| v.to_string()).collect()))
  }

  fn assert_network_error(result: SJMCLResult<Vec<&str>>) {
    match result {
      Err(e) => assert_eq!(e.0, ResourceError::NetworkError.to_string()),
      Ok(versions) => panic!("expected a network error, got {versions:?}"),
    }
  }

  #[test]
  fn supported_version_returns_loader_versions_of_first_source() {
    let game_versions_fetched = Cell::new(false);

    let result = block_on(fetch_loader_versions_with_fallback(
      &SOURCES,
      "1.21.1",
      |_| ready(Ok(vec!["0.16.5"])),
      |_| {
        game_versions_fetched.set(true);
        game_versions(&["1.21.1"])
      },
    ));

    assert_eq!(result.unwrap(), vec!["0.16.5"]);
    assert!(!game_versions_fetched.get());
  }

  #[test]
  fn supported_version_falls_back_to_next_source() {
    let result = block_on(fetch_loader_versions_with_fallback(
      &SOURCES,
      "1.21.1",
      |source_type| match source_type {
        SourceType::Official => network_error(),
        SourceType::BMCLAPIMirror => ready(Ok(vec!["0.16.5"])),
      },
      |_| game_versions(&["1.21.1"]),
    ));

    assert_eq!(result.unwrap(), vec!["0.16.5"]);
  }

  #[test]
  fn unsupported_version_returns_empty_list() {
    let result = block_on(fetch_loader_versions_with_fallback(
      &SOURCES,
      "1.5.1",
      |_| network_error::<Vec<&str>>(),
      |source_type| match source_type {
        SourceType::Official => game_versions(&["1.14", "1.21.1"]),
        SourceType::BMCLAPIMirror => network_error(),
      },
    ));

    assert!(result.unwrap().is_empty());
  }

  #[test]
  fn unsupported_version_confirmed_by_fallback_source_returns_empty_list() {
    let result = block_on(fetch_loader_versions_with_fallback(
      &SOURCES,
      "1.5.1",
      |_| network_error::<Vec<&str>>(),
      |source_type| match source_type {
        SourceType::Official => network_error(),
        SourceType::BMCLAPIMirror => game_versions(&["1.14", "1.21.1"]),
      },
    ));

    assert!(result.unwrap().is_empty());
  }

  #[test]
  fn outdated_game_version_list_does_not_hide_loader_versions_of_other_sources() {
    let result = block_on(fetch_loader_versions_with_fallback(
      &[SourceType::BMCLAPIMirror, SourceType::Official],
      "26.1",
      |source_type| match source_type {
        SourceType::Official => ready(Ok(vec!["0.18.4"])),
        SourceType::BMCLAPIMirror => network_error(),
      },
      |_| game_versions(&["1.21.11"]),
    ));

    assert_eq!(result.unwrap(), vec!["0.18.4"]);
  }

  #[test]
  fn source_failure_returns_error() {
    let result = block_on(fetch_loader_versions_with_fallback(
      &SOURCES,
      "1.21.1",
      |_| network_error::<Vec<&str>>(),
      |_| network_error(),
    ));

    assert_network_error(result);
  }

  #[test]
  fn source_failure_for_listed_game_version_returns_error() {
    let result = block_on(fetch_loader_versions_with_fallback(
      &SOURCES,
      "1.21.1",
      |_| network_error::<Vec<&str>>(),
      |_| game_versions(&["1.21.1"]),
    ));

    assert_network_error(result);
  }
}
