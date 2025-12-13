use crate::launcher_config::models::LauncherConfig;
use crate::resource::helpers::misc::get_source_priority_list;
use crate::resource::helpers::version_manifest::get_game_version_manifest;
use crate::utils::fs::get_app_resource_filepath;
use regex::Regex;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

fn load_versions(app: &AppHandle, path: &str, from_cache: bool) -> Vec<String> {
  let list_file_path: Option<PathBuf> = if from_cache {
    app.path().resolve(path, BaseDirectory::AppCache).ok()
  } else {
    get_app_resource_filepath(app, path).ok()
  };

  // Read & split lines, or return an empty vec
  list_file_path
    .and_then(|p| fs::read_to_string(p).ok())
    .map(|content| content.lines().map(|l| l.trim().to_string()).collect())
    .unwrap_or_default()
}

fn try_find(versions: &[String], version: &str) -> Option<usize> {
  versions.iter().position(|v| v == version)
}

/// Compare two Minecraft version IDs.
/// The order is determined by `assets/game/versions.txt`,
/// or fallback to cache, and optionally refresh from remote manifest if not found.
///
/// # Examples
/// ```
/// if compare_game_versions(&app, version, "1.19", true).await.le(&Ordering::Equal) {
///     println!("{} <= 1.19", version);
/// }
/// ```
///
/// # Parameters
/// - `fallback_fetch_remote`: Whether to refresh the version list from remote if not found in built-in or cache.
///   ⚠️ If enabled, this may take extra time due to network request.
///
/// # Expected result
/// - Returns `Ordering::Less` if `version_a` < `version_b`
/// - Returns `Ordering::Equal` if `version_a` == `version_b`
/// - Returns `Ordering::Greater` if `version_a` > `version_b`, or if `version_a` not found
/// - If both versions are not found, returns `Ordering::Equal`
///
pub async fn compare_game_versions(
  app: &AppHandle,
  version_a: &str,
  version_b: &str,
  fallback_fetch_remote: bool,
) -> Ordering {
  let mut versions = load_versions(app, "assets/game/versions.txt", false);
  let mut idx_a = try_find(&versions, version_a);
  let mut idx_b = try_find(&versions, version_b);

  // Fallback to search in cache version list saved by `get_game_version_manifest()`.
  if idx_a.is_none() || idx_b.is_none() {
    versions = load_versions(app, "game_versions.txt", true);
    idx_a = try_find(&versions, version_a);
    idx_b = try_find(&versions, version_b);
  }

  // Fallback to fetch remote manifest and retry.
  if fallback_fetch_remote && (idx_a.is_none() || idx_b.is_none()) {
    if let Some(state) = app.try_state::<Mutex<LauncherConfig>>() {
      let priority_list = {
        let locked = state.lock().unwrap();
        get_source_priority_list(&locked)
      };
      let _ = get_game_version_manifest(app, &priority_list).await;
      versions = load_versions(app, "game_versions.txt", true);
      idx_a = try_find(&versions, version_a);
      idx_b = try_find(&versions, version_b);
    }
  }

  // compare version ids
  match (idx_a, idx_b) {
    (Some(a), Some(b)) => a.cmp(&b),
    (Some(_), None) => Ordering::Less,
    (None, Some(_)) => Ordering::Greater,
    (None, None) => Ordering::Equal,
  }
}

/// Build a comparator function for Minecraft version IDs based on
/// the built-in or cached version list files.
///
/// The returned comparator can be used directly in sorting operations, e.g.:
///
/// # Examples
/// ```
/// let cmp_fn = build_game_version_cmp_fn(&app);
/// summary_list.sort_by(|a, b| cmp_fn(&a.version, &b.version));
/// ```
///
/// # Returns
/// A closure suitable for `.sort_by()` or `.sort_by_key()` usage.
///
pub fn build_game_version_cmp_fn(app: &AppHandle) -> impl Fn(&str, &str) -> Ordering {
  let mut versions = load_versions(app, "assets/game/versions.txt", false);

  if versions.is_empty() {
    versions = load_versions(app, "game_versions.txt", true);
  }

  let index_map: HashMap<String, usize> = versions
    .into_iter()
    .enumerate()
    .map(|(i, v)| (v, i))
    .collect();

  // Return the comparator closure
  move |a: &str, b: &str| {
    let idx_a = index_map.get(a);
    let idx_b = index_map.get(b);

    match (idx_a, idx_b) {
      (Some(&a), Some(&b)) => a.cmp(&b),
      (Some(_), None) => Ordering::Less,
      (None, Some(_)) => Ordering::Greater,
      (None, None) => Ordering::Equal,
    }
  }
}

/// Find the major game version ("1.x" or "YY.x") corresponding to the provided game version.
/// If the version starts with a dot-separated number (e.g., 1.7, 1.18-pre1, 26.1-snapshot),
/// it returns the parsed major version (e.g., 1.7, 1.18, 26.1).
/// Otherwise (e.g., snapshot format like "24w02a"), it will return the corresponding major version found from the list.
///
/// It is noted that the version number system of Minecraft has a breaking change starting in 2026 ("1.x" to "YY.x")
/// ref: https://www.minecraft.net/en-us/article/minecraft-new-version-numbering-system
///
/// # Examples
/// ```
/// let version = get_major_game_version(&app, "1.18-pre1", true).await;
/// println!("Major version of 1.18-pre1: {}", version); // => "1.18"
///
/// let version = get_major_game_version(&app, "26.1.1", false).await;
/// println!("Major version of 26.1.1: {}", version); // => "26.1"
///
/// let version = get_major_game_version(&app, "24w09a", false).await;
/// println!("Major version of 24w09a: {}", version); // => "1.20.4" => "1.20"
/// ```
///
/// # Parameters
/// - `fallback_fetch_remote`: Whether to refresh the version list from remote if not found in built-in or cache.
///   ⚠️ If enabled, this may take extra time due to network request.
///
/// # Expected result
/// - Returns the major version if the input version starts with "1.x" or "YY.x"
/// - Returns the closest major version from the list otherwise
/// - Returns empty string as fallback.
pub async fn get_major_game_version(
  app: &AppHandle,
  version: &str,
  fallback_fetch_remote: bool,
) -> String {
  fn is_semver_like_version(version: &str) -> bool {
    lazy_static::lazy_static! {
        static ref SEMVER_LIKE_PREFIX: Regex = Regex::new(
          r"^\d+\..+"
        ).unwrap();
    }
    SEMVER_LIKE_PREFIX.is_match(version.trim())
  }

  fn extract_major_version(version: &str) -> String {
    let version = version.split_whitespace().next().unwrap_or(version); // handle "1.14 Pre-Release 1" 😣
    version
      .split('-')
      .next()
      .map(|v| v.split('.').take(2).collect::<Vec<_>>().join("."))
      .unwrap_or_else(|| version.to_string())
  }

  fn find_closest_major_version(versions: &[String], idx: usize) -> String {
    for i in (0..idx).rev() {
      if is_semver_like_version(&versions[i]) {
        return extract_major_version(&versions[i]);
      }
    }
    String::new() // no major version found before the input version
  }

  if version.trim().is_empty() {
    return String::new();
  }

  // If the input version starts with "1.x" or "YY.x", return the major version directly (e.g., 1.21 from 1.21.4)
  if is_semver_like_version(version) {
    return extract_major_version(version);
  }

  let mut versions = load_versions(app, "assets/game/versions.txt", false);
  if let Some(idx) = try_find(&versions, version) {
    return find_closest_major_version(&versions, idx);
  }

  versions = load_versions(app, "game_versions.txt", true);
  if let Some(idx) = try_find(&versions, version) {
    return find_closest_major_version(&versions, idx);
  }

  if fallback_fetch_remote {
    if let Some(state) = app.try_state::<Mutex<LauncherConfig>>() {
      let priority_list = {
        let locked = state.lock().unwrap();
        get_source_priority_list(&locked)
      };
      let _ = get_game_version_manifest(app, &priority_list).await;
      versions = load_versions(app, "game_versions.txt", true);
      if let Some(idx) = try_find(&versions, version) {
        return find_closest_major_version(&versions, idx);
      }
    }
  }

  String::new()
}
