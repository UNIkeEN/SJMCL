use crate::launcher_config::models::LauncherConfig;
use crate::EXE_DIR;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub const ACCESS_TOKEN_EXPIRED: &str = "%failed:access_token_expired%";

// Build a list of candidate directories to search for portable launchers (with account storage) when importing accounts.
pub fn list_launcher_candidate_dirs(app: &AppHandle) -> Vec<PathBuf> {
  let mut dirs = HashSet::new();
  dirs.insert(EXE_DIR.clone());
  let local_game_directories = {
    let binding = app.state::<Mutex<LauncherConfig>>();
    let state = binding.lock().unwrap();
    state.local_game_directories.clone()
  };
  for gd in &local_game_directories {
    if let Some(parent) = gd.dir.parent() {
      dirs.insert(parent.to_path_buf());
    }
  }
  dirs.into_iter().collect()
}
