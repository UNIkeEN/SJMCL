use super::helpers::{cmd_builder::generate_launch_cmd, file_validator::validate_library_files};
use crate::{
  error::SJMCLResult,
  instance::{
    helpers::{
      client_json::{DownloadsArtifact, McClientInfo},
      misc::{get_instance_client_json_path, get_instance_subdir_path},
    },
    models::misc::{InstanceError, InstanceSubdirType},
  },
  launch::helpers::cmd_builder::{execute_cmd, ExecuteType},
  storage::load_json_async,
};
use tauri::AppHandle;

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
    load_json_async::<McClientInfo>(&path).await?
  } else {
    return Err(InstanceError::FileNotFoundError.into());
  };
  let bad_artifacts = validate_library_files(&library_dir, &client_info).await?;
  println!("{:?}", bad_artifacts);
  Ok(bad_artifacts)
}

#[tauri::command]
pub async fn launch_game(app: AppHandle, instance_id: usize) -> SJMCLResult<()> {
  println!("instance id: {}", instance_id);
  let client_info = if let Some(path) = get_instance_client_json_path(&app, instance_id) {
    load_json_async::<McClientInfo>(&path).await?
  } else {
    return Err(InstanceError::FileNotFoundError.into());
  };
  println!("{}:{}", std::file!(), std::line!());
  let cmd = match generate_launch_cmd(&app, &instance_id, client_info).await {
    Ok(cmd) => cmd,
    Err(e) => {
      println!("generate_launch_cmd {:?}", e);
      return Err(e);
    }
  };
  println!("{}", cmd.args.join(" "));
  let output = execute_cmd(cmd, &ExecuteType::NormalExecution).await?;
  println!("{}", String::from_utf8_lossy(&output.stdout));
  println!("{}", String::from_utf8_lossy(&output.stderr));
  Ok(())
}
