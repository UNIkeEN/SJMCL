use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Manager};

use crate::launcher_config::models::LauncherConfig;

pub fn find_game_dirs_with_file(app: &AppHandle, filename: &str) -> Vec<PathBuf> {
  let mut dirs = HashSet::new();
  if let Ok(exe) = std::env::current_exe() {
    if let Some(exe_dir) = exe.parent() {
      dirs.insert(exe_dir.to_path_buf());
    }
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
  dirs
    .into_iter()
    .filter(|dir| dir.join(filename).is_file())
    .collect()
}
