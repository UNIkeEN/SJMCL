use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use url::Url;

use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::helpers::client_json::McClientInfo;
use crate::instance::helpers::loader::common::add_library_entry;
use crate::instance::models::misc::ModLoader;
use crate::launch::helpers::file_validator::convert_library_name_to_path;
use crate::resource::helpers::misc::{convert_url_to_target_source, get_download_api};
use crate::resource::models::{ResourceType, SourceType};
use crate::tasks::download::DownloadParam;
use crate::tasks::PTaskParam;

fn resolve_maven_root<'a>(coord: &str, quilt_root: &'a str) -> &'a str {
  if coord.starts_with("net.fabricmc") {
    "https://maven.fabricmc.net/"
  } else {
    quilt_root
  }
}

pub async fn install_quilt_loader(
  app: AppHandle,
  priority: &[SourceType],
  game_version: &str,
  loader: &ModLoader,
  lib_dir: PathBuf,
  _mods_dir: PathBuf,
  client_info: &mut McClientInfo,
  task_params: &mut Vec<PTaskParam>,
) -> SJMCLResult<()> {
  let client = app.state::<reqwest::Client>();
  let loader_ver = &loader.version;

  let meta_url = get_download_api(priority[0], ResourceType::QuiltMeta)?
    .join(&format!("v3/versions/loader/{game_version}/{loader_ver}"))?;

  let meta: serde_json::Value = client.get(meta_url).send().await?.json().await?;

  let loader_path = meta["loader"]["maven"]
    .as_str()
    .ok_or(SJMCLError("meta missing loader maven".to_string()))?;
  let int_path = meta["intermediary"]["maven"]
    .as_str()
    .ok_or(SJMCLError("meta missing intermediary maven".to_string()))?;
  let hashed_path = meta["hashed"]["maven"]
    .as_str()
    .ok_or(SJMCLError("meta missing hashed maven".to_string()))?;

  let main_class = meta["launcherMeta"]["mainClass"]["client"]
    .as_str()
    .ok_or(SJMCLError("missing mainClass.client".to_string()))?;
  client_info.main_class = Some(main_class.to_string());

  let mut new_patch = McClientInfo {
    id: "quilt".to_string(),
    version: Some(loader_ver.to_string()),
    priority: Some(30000),
    ..Default::default()
  };

  let quilt_maven = get_download_api(priority[0], ResourceType::QuiltMaven)?;

  for path in &[loader_path, int_path, hashed_path] {
    add_library_entry(&mut client_info.libraries, path, None)?;
    add_library_entry(&mut new_patch.libraries, path, None)?;
  }

  let launcher_meta = &meta["launcherMeta"]["libraries"];
  for side in ["common", "server", "client", "development"] {
    if let Some(arr) = launcher_meta.get(side).and_then(|v| v.as_array()) {
      for item in arr {
        if let Some(name) = item["name"].as_str() {
          let url = item
            .get("url")
            .and_then(|v| v.as_str())
            .unwrap_or_else(|| resolve_maven_root(name, quilt_maven.as_str()));

          add_library_entry(&mut client_info.libraries, name, None)?;
          add_library_entry(&mut new_patch.libraries, name, None)?;

          let rel: String = convert_library_name_to_path(name, None)?;
          let src = convert_url_to_target_source(
            &Url::parse(url)?.join(&rel)?,
            &[ResourceType::QuiltMaven, ResourceType::Libraries],
            &priority[0],
          )?;

          task_params.push(PTaskParam::Download(DownloadParam {
            src,
            dest: lib_dir.join(&rel),
            filename: None,
            sha1: None,
          }));
        }
      }
    }
  }
  client_info.patches.push(new_patch);

  for path in &[loader_path, int_path, hashed_path] {
    let rel: String = convert_library_name_to_path(path, None)?;
    let root = resolve_maven_root(path, quilt_maven.as_str());
    let src = convert_url_to_target_source(
      &Url::parse(root)?.join(&rel)?,
      &[ResourceType::QuiltMaven, ResourceType::Libraries],
      &priority[0],
    )?;
    task_params.push(PTaskParam::Download(DownloadParam {
      src,
      dest: lib_dir.join(&rel),
      filename: None,
      sha1: None,
    }));
  }

  Ok(())
}
