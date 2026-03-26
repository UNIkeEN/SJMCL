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

const QFAPI_MOD_ID_MODRINTH: &str = "qvIfYCYJ";

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
  mods_dir: PathBuf,
  client_info: &mut McClientInfo,
  task_params: &mut Vec<PTaskParam>,
  is_install_qf_api: Option<bool>,
) -> SJMCLResult<()> {
  let client = app.state::<reqwest::Client>();
  let loader_ver = &loader.version;

  let mut meta: Option<serde_json::Value> = None;
  let mut quilt_maven: Option<Url> = None;

  for source_type in priority.iter() {
    if let Ok(base_url) = get_download_api(*source_type, ResourceType::QuiltMeta) {
      if let Ok(url) = base_url.join(&format!("v3/versions/loader/{game_version}/{loader_ver}")) {
        match client.get(url.clone()).send().await {
          Ok(resp) if resp.status().is_success() => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
              meta = Some(json);
              if let Ok(maven_url) = get_download_api(*source_type, ResourceType::QuiltMaven) {
                quilt_maven = Some(maven_url);
              }
              break;
            }
          }
          _ => continue,
        }
      }
    }
  }

  let meta = meta.ok_or(SJMCLError("failed to fetch Quilt loader meta".to_string()))?;
  let quilt_maven = quilt_maven.ok_or(SJMCLError("failed to get Quilt Maven URL".to_string()))?;

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

  for path in &[loader_path, int_path, hashed_path] {
    add_library_entry(&mut client_info.libraries, path, None)?;
    add_library_entry(&mut new_patch.libraries, path, None)?;
  }

  let launcher_meta = &meta["launcherMeta"]["libraries"];
  for side in ["common", "server", "client", "development"] {
    if let Some(arr) = launcher_meta.get(side).and_then(|v| v.as_array()) {
      for item in arr {
        if let Some(name) = item["name"].as_str() {
          let root_url = item
            .get("url")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| resolve_maven_root(name, quilt_maven.as_str()).to_string());

          add_library_entry(&mut client_info.libraries, name, None)?;
          add_library_entry(&mut new_patch.libraries, name, None)?;

          let rel: String = convert_library_name_to_path(name, None)?;
          let full_url = Url::parse(&root_url)?.join(&rel)?;

          // fallback priority
          let mut src_opt = None;
          for source_type in priority.iter() {
            if let Ok(src) = convert_url_to_target_source(
              &full_url,
              &[
                ResourceType::QuiltMaven,
                ResourceType::FabricMaven,
                ResourceType::Libraries,
              ],
              source_type,
            ) {
              src_opt = Some(src);
              break;
            }
          }
          let src = src_opt.ok_or(SJMCLError(format!(
            "failed to create download source for {}",
            name
          )))?;

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
    let root_url = resolve_maven_root(path, quilt_maven.as_str());
    let full_url = Url::parse(root_url)?.join(&rel)?;

    let mut src_opt = None;
    for source_type in priority.iter() {
      if let Ok(src) = convert_url_to_target_source(
        &full_url,
        &[
          ResourceType::QuiltMaven,
          ResourceType::FabricMaven,
          ResourceType::Libraries,
        ],
        source_type,
      ) {
        src_opt = Some(src);
        break;
      }
    }
    let src = src_opt.ok_or(SJMCLError(format!(
      "failed to create download source for {}",
      path
    )))?;

    task_params.push(PTaskParam::Download(DownloadParam {
      src,
      dest: lib_dir.join(&rel),
      filename: None,
      sha1: None,
    }));
  }

  if is_install_qf_api.unwrap_or(true) {
    if let Ok(Some(qfapi_download)) = fetch_latest_mod_download_param_modrinth(
      &app,
      QFAPI_MOD_ID_MODRINTH,
      ModLoaderType::Quilt,
      game_version,
      mods_dir,
    )
    .await
    {
      task_params.push(PTaskParam::Download(qfapi_download));
    }
  }

  Ok(())
}
