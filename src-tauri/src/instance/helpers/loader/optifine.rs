use reqwest::redirect::Policy;
use reqwest::{Client, Error};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_http::reqwest;
use url::Url;
use zip::ZipArchive;

use crate::error::SJMCLResult;
use crate::instance::helpers::client_json::{LaunchArgumentTemplate, LibrariesValue, McClientInfo};
use crate::instance::helpers::loader::common::add_library_entry;
use crate::instance::helpers::misc::get_instance_subdir_paths;
use crate::instance::models::misc::{Instance, InstanceError, InstanceSubdirType, ModLoader};
use crate::launch::helpers::file_validator::convert_library_name_to_path;
use crate::resource::helpers::misc::{convert_url_to_target_source, get_download_api};
use crate::resource::models::{OptifineResourceInfo, ResourceType, SourceType};
use crate::tasks::commands::schedule_progressive_task_group;
use crate::tasks::download::DownloadParam;
use crate::tasks::PTaskParam;

pub async fn install_optifine(
  priority: &[SourceType],
  game_version: &str,
  optifine: &OptifineResourceInfo,
  lib_dir: PathBuf,
  task_params: &mut Vec<PTaskParam>,
) -> SJMCLResult<()> {
  let root = get_download_api(priority[0], ResourceType::Optifine)?;

  let installer_url = match priority.first().unwrap_or(&SourceType::Official) {
    &SourceType::Official => root.join(&format!(
      "{}/{}/{}",
      game_version, optifine.r#type, optifine.patch
    ))?,
    &SourceType::BMCLAPIMirror => root.join(&format!(
      "{}/{}/{}",
      game_version, optifine.r#type, optifine.patch
    ))?,
  };

  let installer_coord = format!(
    "net.minecraftforge:optifine:{}-installer",
    optifine.filename
  );
  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = lib_dir.join(&installer_rel);

  task_params.push(PTaskParam::Download(DownloadParam {
    src: installer_url,
    dest: installer_path.clone(),
    filename: None,
    sha1: None,
  }));

  Ok(())
}
