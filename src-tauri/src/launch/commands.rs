use super::helpers::{
  cmd_builder::{collect_launch_params, generate_launch_cmd},
  file_validator::validate_library_files,
};
use crate::{
  error::{SJMCLError, SJMCLResult},
  instance::{
    helpers::{
      client_json::{load_client_info_from_json, DownloadsArtifact},
      misc::{get_instance_client_json_path, get_instance_subdir_path},
    },
    models::misc::{InstanceError, InstanceSubdirType},
  },
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
    load_client_info_from_json(&path).await?
  } else {
    return Err(InstanceError::FileNotFoundError.into());
  };
  let bad_artifacts = validate_library_files(&library_dir, &client_info).await?;
  Ok(bad_artifacts)
}

#[tauri::command]
pub async fn launch_game(app: AppHandle, instance_id: usize) -> SJMCLResult<()> {
  println!("instance id: {}", instance_id);
  let client_info = if let Some(path) = get_instance_client_json_path(&app, instance_id) {
    load_client_info_from_json(&path).await?
  } else {
    return Err(InstanceError::FileNotFoundError.into());
  };
  let argument_template = if let Some(ref arguments) = &client_info.arguments {
    arguments.clone()
  } else {
    return Err(SJMCLError(String::new()));
  };
  let main_class = client_info.main_class.clone();
  match collect_launch_params(&app, &instance_id, client_info) {
    Ok((launch_params, launch_feature)) => println!(
      "{}",
      generate_launch_cmd(
        &launch_params,
        &argument_template,
        main_class,
        &launch_feature
      )?
      .join(" ")
    ),
    Err(e) => println!("COLLECT LAUNCH PARAMS ERROR: {:?}", e),
  }

  Ok(())
}
