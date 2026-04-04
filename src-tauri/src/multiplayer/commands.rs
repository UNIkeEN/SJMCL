use crate::{
  error::{SJMCLError, SJMCLResult},
  launch::models::LaunchingState,
  multiplayer::helpers::terracotta::{
    build_download_param, decompress, download_terracotta_archive, is_terracotta_ready,
  },
  resource::models::ResourceError,
};
use rand::Rng;
use std::sync::Mutex;
use sysinfo::{Pid, System};
use tauri::{AppHandle, State};

fn is_valid_invite_code(invite_code: &str) -> bool {
  invite_code.len() == 6 && invite_code.chars().all(|char| char.is_ascii_digit())
}

fn has_open_instance(launching_queue: &[LaunchingState]) -> bool {
  let system = System::new_all();

  launching_queue
    .iter()
    .any(|state| state.pid != 0 && system.process(Pid::from_u32(state.pid)).is_some())
}

#[tauri::command]
pub async fn check_terracotta_support(app: AppHandle) -> SJMCLResult<bool> {
  is_terracotta_ready(&app)
}

#[tauri::command]
pub async fn download_terracotta(app: AppHandle) -> SJMCLResult<()> {
  let download_param = build_download_param(&app).await?;
  if download_param.is_empty() {
    return Err(ResourceError::NoDownloadApi.into());
  }
  download_terracotta_archive(&app, &download_param[0]).await?;
  decompress(&app).await?;
  Ok(())
}

#[tauri::command]
pub async fn join_room(invite_code: String) -> SJMCLResult<()> {
  if !is_valid_invite_code(&invite_code) {
    return Err(SJMCLError("INVALID_INVITE_CODE".to_string()));
  }

  Ok(())
}

#[tauri::command]
pub async fn create_room(
  launching_queue_state: State<'_, Mutex<Vec<LaunchingState>>>,
) -> SJMCLResult<String> {
  if !has_open_instance(&launching_queue_state.lock()?) {
    return Err(SJMCLError("NO_OPEN_INSTANCE".to_string()));
  }

  let mut rng = rand::rng();
  Ok(format!("{:06}", rng.random_range(0..1_000_000)))
}
