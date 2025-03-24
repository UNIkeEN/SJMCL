use crate::{
  account::helpers::authlib_injector::constants::AUTHLIB_INJECTOR_JAR_NAME, error::SJMCLResult,
};
use std::path::PathBuf;
use tauri::{path::BaseDirectory, AppHandle, Manager};

pub fn get_authlib_injector_jar_path(app: &AppHandle) -> SJMCLResult<PathBuf> {
  Ok(
    app
      .path()
      .resolve::<PathBuf>(AUTHLIB_INJECTOR_JAR_NAME.into(), BaseDirectory::AppData)?,
  )
}
