use std::sync::Mutex;

use tauri::{AppHandle, Manager};

use crate::account::models::AccountInfo;
use crate::error::SJMCLResult;
use crate::launcher_config::models::LauncherConfig;

pub fn with_lock_state<F, R, T: Send + Sync + 'static>(app: &AppHandle, f: F) -> SJMCLResult<R>
where
  F: FnOnce(&mut T) -> SJMCLResult<R>,
{
  let binding = app.state::<Mutex<T>>();
  let mut state = binding.lock()?;
  f(&mut state)
}

#[inline(always)]
pub fn with_account_info<F, R>(app: &AppHandle, f: F) -> SJMCLResult<R>
where
  F: FnOnce(&mut AccountInfo) -> SJMCLResult<R>,
{
  with_lock_state(app, f)
}

#[inline(always)]
pub fn with_launcher_config<F, R>(app: &AppHandle, f: F) -> SJMCLResult<R>
where
  F: FnOnce(&mut LauncherConfig) -> SJMCLResult<R>,
{
  with_lock_state(app, f)
}
