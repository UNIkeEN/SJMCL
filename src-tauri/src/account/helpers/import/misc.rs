use crate::launcher_config::models::LauncherConfig;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::LazyLock;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub const ACCESS_TOKEN_EXPIRED: &str = "%failed:access_token_expired%";
static EXE_DIR: LazyLock<Option<PathBuf>> = LazyLock::new(|| {
  std::env::current_exe()
    .ok()
    .and_then(|p| p.parent().map(|p| p.to_path_buf()))
});

pub fn find_game_dirs(app: &AppHandle) -> Vec<PathBuf> {
  let mut dirs = HashSet::new();
  if let Some(exe_dir) = &*EXE_DIR {
    dirs.insert(exe_dir.clone());
  }
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
