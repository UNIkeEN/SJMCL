use regex::Regex;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use url::Url;

use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::helpers::client_json::McClientInfo;
use crate::instance::helpers::loader::common::add_library_entry;
use crate::instance::models::misc::{ModLoader, ModLoaderType};
use crate::launch::helpers::file_validator::convert_library_name_to_path;
use crate::resource::helpers::misc::{convert_url_to_target_source, get_download_api};
use crate::resource::helpers::modrinth::fetch_latest_mod_download_param_modrinth;
use crate::resource::models::{ResourceType, SourceType};
use crate::tasks::download::DownloadParam;
use crate::tasks::PTaskParam;
use crate::utils::fs::get_files_with_regex;

const FABRIC_API_MOD_ID_MODRINTH: &str = "P7dR8mSH";

pub async fn install_fabric_loader(
  app: AppHandle,
  priority: &[SourceType],
  game_version: &str,
  loader: &ModLoader,
  lib_dir: PathBuf,
  mods_dir: PathBuf,
  client_info: &mut McClientInfo,
  task_params: &mut Vec<PTaskParam>,
  is_install_fabric_api: Option<bool>,
) -> SJMCLResult<()> {
  let client = app.state::<reqwest::Client>();
  let loader_ver = &loader.version;

  let mut meta: Option<serde_json::Value> = None;
  let mut maven_root: Option<Url> = None;

  for source_type in priority.iter() {
    if let Ok(root) = get_download_api(*source_type, ResourceType::FabricMeta) {
      if let Ok(url) = root.join(&format!("v2/versions/loader/{game_version}/{loader_ver}")) {
        match client.get(url.clone()).send().await {
          Ok(resp) if resp.status().is_success() => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
              meta = Some(json);
              maven_root = Some(get_download_api(*source_type, ResourceType::FabricMaven)?);
              break;
            }
          }
          _ => continue,
        }
      }
    }
  }

  let meta = meta.ok_or(SJMCLError("failed to fetch Fabric meta".to_string()))?;
  let maven_root = maven_root.ok_or(SJMCLError("failed to get Fabric Maven URL".to_string()))?;

  let loader_path = meta["loader"]["maven"]
    .as_str()
    .ok_or(SJMCLError("meta missing loader maven".to_string()))?;

  let int_path = meta["intermediary"]["maven"]
    .as_str()
    .ok_or(SJMCLError("meta missing intermediary maven".to_string()))?;

  let main_class = meta["launcherMeta"]["mainClass"]["client"]
    .as_str()
    .ok_or(SJMCLError("missing mainClass.client".to_string()))?;

  client_info.main_class = Some(main_class.to_string());

  let mut new_patch = McClientInfo {
    id: "fabric".to_string(),
    version: Some(loader_ver.to_string()),
    priority: Some(30000),
    ..Default::default()
  };

  for path in &[loader_path, int_path] {
    add_library_entry(&mut client_info.libraries, path, None)?;
    add_library_entry(&mut new_patch.libraries, path, None)?;
  }

  let launcher_meta = &meta["launcherMeta"]["libraries"];
  for side in ["common", "server", "client"] {
    if let Some(arr) = launcher_meta.get(side).and_then(|v| v.as_array()) {
      for item in arr {
        if let Some(name) = item["name"].as_str() {
          add_library_entry(&mut client_info.libraries, name, None)?;
          add_library_entry(&mut new_patch.libraries, name, None)?;
        }
      }
    }
  }

  client_info.patches.push(new_patch);

  let mut push_task = |coord: &str, url_root: &Url| -> SJMCLResult<()> {
    let rel: String = convert_library_name_to_path(coord, None)?;
    let mut src_opt = None;
    for source_type in priority.iter() {
      if let Ok(src) = convert_url_to_target_source(
        &url_root.join(&rel)?,
        &[ResourceType::FabricMaven, ResourceType::Libraries],
        source_type,
      ) {
        src_opt = Some(src);
        break;
      }
    }
    if let Some(src) = src_opt {
      task_params.push(PTaskParam::Download(DownloadParam {
        src,
        dest: lib_dir.join(&rel),
        filename: None,
        sha1: None,
      }));
    }
    Ok(())
  };

  push_task(loader_path, &maven_root)?;
  push_task(int_path, &maven_root)?;

  for side in ["common", "server", "client"] {
    if let Some(arr) = launcher_meta.get(side).and_then(|v| v.as_array()) {
      for item in arr {
        if let Some(name) = item["name"].as_str() {
          let url_root = item
            .get("url")
            .and_then(|v| v.as_str())
            .and_then(|s| Url::parse(s).ok())
            .unwrap_or_else(|| maven_root.clone());
          push_task(name, &url_root)?;
        }
      }
    }
  }

  if is_install_fabric_api.unwrap_or(true) {
    if let Ok(Some(fabric_api_download)) = fetch_latest_mod_download_param_modrinth(
      &app,
      FABRIC_API_MOD_ID_MODRINTH,
      ModLoaderType::Fabric,
      game_version,
      mods_dir,
    )
    .await
    {
      task_params.push(PTaskParam::Download(fabric_api_download));
    }
  }

  Ok(())
}

pub async fn remove_fabric_api_mods<P: AsRef<Path>>(mods_dir: P) -> SJMCLResult<()> {
  let mods_dir = mods_dir.as_ref();
  if !mods_dir.exists() {
    return Ok(());
  }
  let re = Regex::new(r"(?i)^(fabric-api|quilted-fabric-api)-.*\.jar$")
    .map_err(|e| SJMCLError(format!("Invalid regex: {}", e)))?;
  let targets: Vec<PathBuf> = get_files_with_regex(mods_dir, &re).unwrap_or_default();
  for p in targets {
    let name = p
      .file_name()
      .and_then(|s| s.to_str())
      .unwrap_or_default()
      .to_string();
    fs::remove_file(&p).map_err(|e| SJMCLError(format!("Failed to remove {}: {}", name, e)))?;
  }

  Ok(())
}
