use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use url::Url;

use super::common::add_library_entry;
use crate::instance::helpers::client_json::{McClientInfo, PatchesInfo};
use crate::launch::helpers::file_validator::convert_library_name_to_path;
use crate::resource::helpers::misc::convert_url_to_target_source;
use crate::{
  error::{SJMCLError, SJMCLResult},
  instance::models::misc::ModLoader,
  resource::{
    helpers::misc::get_download_api,
    models::{ResourceType, SourceType},
  },
  tasks::{download::DownloadParam, PTaskParam},
};

pub async fn install_fabric_loader(
  app: AppHandle,
  priority: &[SourceType],
  game_version: &str,
  loader: &ModLoader,
  lib_dir: PathBuf,
  client_info: &mut McClientInfo,
  task_params: &mut Vec<PTaskParam>,
) -> SJMCLResult<()> {
  let client = app.state::<reqwest::Client>();
  let loader_ver = &loader.version;

  let meta_url = get_download_api(priority[0], ResourceType::FabricMeta)?
    .join(&format!("v2/versions/loader/{game_version}/{loader_ver}"))?;

  let meta: serde_json::Value = client.get(meta_url).send().await?.json().await?;

  let loader_path = meta["loader"]["maven"]
    .as_str()
    .ok_or(SJMCLError("meta missing loader maven".to_string()))?;

  let int_path = meta["intermediary"]["maven"]
    .as_str()
    .ok_or(SJMCLError("meta missing intermediary maven".to_string()))?;

  let main_class = meta["launcherMeta"]["mainClass"]["client"]
    .as_str()
    .ok_or(SJMCLError("missing mainClass.client".to_string()))?;

  client_info.main_class = main_class.to_string();

  let mut new_patch = PatchesInfo {
    id: "fabric".to_string(),
    version: loader_ver.to_string(),
    priority: 30000,
    ..Default::default()
  };

  let maven_root = get_download_api(priority[0], ResourceType::FabricMaven)?;

  add_library_entry(&mut client_info.libraries, loader_path, None)?;
  add_library_entry(&mut client_info.libraries, int_path, None)?;
  add_library_entry(&mut new_patch.libraries, loader_path, None)?;
  add_library_entry(&mut new_patch.libraries, int_path, None)?;

  let launcher_meta = &meta["launcherMeta"]["libraries"];
  for side in ["common", "server", "client"] {
    if let Some(arr) = launcher_meta.get(side).and_then(|v| v.as_array()) {
      for item in arr {
        let name = item["name"].as_str().unwrap();
        add_library_entry(&mut client_info.libraries, name, None)?;
        add_library_entry(&mut new_patch.libraries, name, None)?;
      }
    }
  }

  client_info.patches.push(new_patch);

  let mut push_task = |coord: &str, url_root: &str| -> SJMCLResult<()> {
    let rel: String = convert_library_name_to_path(coord, None)?;
    let src = convert_url_to_target_source(
      &Url::parse(url_root)?.join(&rel)?,
      &[ResourceType::FabricMaven, ResourceType::Libraries],
      &priority[0],
    )?;
    task_params.push(PTaskParam::Download(DownloadParam {
      src,
      dest: lib_dir.join(&rel),
      filename: None,
      sha1: None,
    }));
    Ok(())
  };

  push_task(loader_path, maven_root.as_str())?;
  push_task(int_path, maven_root.as_str())?;

  for side in ["common", "server", "client"] {
    if let Some(arr) = launcher_meta.get(side).and_then(|v| v.as_array()) {
      for item in arr {
        let name = item["name"].as_str().unwrap();
        let url = item
          .get("url")
          .and_then(|v| v.as_str())
          .unwrap_or(maven_root.as_str());
        push_task(name, url)?;
      }
    }
  }

  Ok(())
}
