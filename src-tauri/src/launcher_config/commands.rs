use super::helpers::save_config;
use super::models::{LauncherConfig, MemoryInfo};
use std::sync::Mutex;
use systemstat::{saturating_sub_bytes, Platform};
use tauri::State;

#[tauri::command]
pub fn get_launcher_config(state: State<'_, Mutex<LauncherConfig>>) -> LauncherConfig {
  state.lock().unwrap().clone()
}

#[tauri::command]
pub fn update_launcher_config(
  launcher_config: LauncherConfig,
  state: State<'_, Mutex<LauncherConfig>>,
) {
  let mut state = state.lock().unwrap();
  *state = launcher_config;
  save_config(&state);
}

#[tauri::command]
pub fn get_memory_info() -> Result<MemoryInfo, String> {
  let sys = systemstat::System::new();
  match sys.memory() {
    Ok(mem) => Ok(MemoryInfo {
      total: mem.total.as_u64(),
      used: saturating_sub_bytes(mem.total, mem.free).as_u64(),
    }),
    Err(e) => Err(e.to_string()),
  }
}
