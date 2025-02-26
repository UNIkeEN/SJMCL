use tauri::AppHandle;

use super::helpers::file_validator::validate_library_files;
use crate::{
  error::SJMCLResult,
  instance::{
    helpers::{
      client::{load_client_info_from_json, DownloadsArtifact},
      misc::{get_instance_client_json_path, get_instance_subdir_path},
    },
    models::{InstanceError, InstanceSubdirType},
  },
};

#[tauri::command]
pub async fn validate_game_files(
  app: AppHandle,
  instance_id: usize,
) -> SJMCLResult<Vec<DownloadsArtifact>> {
  let library_dir =
    match get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::Libraries) {
      Some(path) => path,
      None => return Err(InstanceError::InstanceNotFoundByID.into()),
    };
  let client_info = if let Some(path) = get_instance_client_json_path(&app, instance_id) {
    load_client_info_from_json(&path).await?
  } else {
    return Err(InstanceError::FileNotFoundError.into());
  };
  let bad_artifacts = validate_library_files(&library_dir, &client_info).await?;
  Ok(bad_artifacts)
}
