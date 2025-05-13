use crate::launcher_config::models::LauncherConfig;
use crate::resource::helpers::{
  misc::get_source_priority_list, version_manifest::get_game_version_manifest,
};
use crate::utils::fs::get_app_resource_filepath;
use std::{cmp::Ordering, fs, path::PathBuf, sync::Mutex};
use tauri::{path::BaseDirectory, AppHandle, Manager};

/// Compare two Minecraft version IDs.
/// The order is determined by `assets/game/versions.txt`,
/// or fallback to cache, or fetch remote if necessary.
///
/// # Examples
/// ```
/// if compare_game_versions(&app, version, "1.19").await.le(&Ordering::Equal) {
///     println!("{} <= 1.19", version);
/// }
/// ```
///
/// # Expected result
/// - Returns `Ordering::Less` if `version_a` < `version_b`
/// - Returns `Ordering::Equal` if `version_a` == `version_b`
/// - Returns `Ordering::Greater` if `version_a` > `version_b`, or if `version_a` not found
/// - If both versions are not found, returns `Ordering::Equal`
///
pub async fn compare_game_versions(app: &AppHandle, version_a: &str, version_b: &str) -> Ordering {
  let try_find = |versions: &[String]| -> (Option<usize>, Option<usize>) {
    (
      versions.iter().position(|v| v == version_a),
      versions.iter().position(|v| v == version_b),
    )
  };

  fn load_versions(app: &AppHandle, path: &str, from_cache: bool) -> Vec<String> {
    let list_file_path: Option<PathBuf> = if from_cache {
      app.path().resolve(path, BaseDirectory::AppCache).ok()
    } else {
      get_app_resource_filepath(app, path).ok()
    };

    // read & split lines, or return empty vec
    list_file_path
      .and_then(|p| fs::read_to_string(p).ok())
      .map(|content| content.lines().map(|l| l.trim().to_string()).collect())
      .unwrap_or_default()
  }

  // Try to search version ids in built-in version list.
  let mut versions = load_versions(app, "assets/game/versions.txt", false);
  let (mut idx_a, mut idx_b) = try_find(&versions);

  // Fallback to search in cache version list saved by `get_game_version_manifest()`.
  if idx_a.is_none() || idx_b.is_none() {
    versions = load_versions(app, "game_versions.txt", true);
    (idx_a, idx_b) = try_find(&versions);
  }

  // Fallback to fetch remote manifest and retry.
  if idx_a.is_none() || idx_b.is_none() {
    if let Some(state) = app.try_state::<Mutex<LauncherConfig>>() {
      let priority_list = {
        let locked = state.lock().unwrap(); // unwrap: 应用内State，不会panic
        get_source_priority_list(&locked)
      };
      let _ = get_game_version_manifest(app, &priority_list).await;
      versions = load_versions(app, "game_versions.txt", true);
      (idx_a, idx_b) = try_find(&versions);
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
