use crate::instance::helpers::client_json::{
  LibrariesValue, McClientInfo, reset_fields_from_patches,
};
use crate::instance::helpers::misc::get_instance_subdir_paths;
use crate::instance::models::misc::{Instance, InstanceError, InstanceSubdirType, ModLoader};
use crate::launch::helpers::file_validator::convert_library_name_to_path;
use crate::resource::helpers::misc::get_download_api;
use crate::resource::models::{ResourceType, SourceType};
use crate::tasks::PTaskParam;
use crate::tasks::commands::schedule_progressive_task_group;
use crate::tasks::download::DownloadParam;
use crate::utils::fs::get_app_resource_filepath;
use reqwest_middleware::reqwest::redirect::Policy;
use reqwest_middleware::reqwest::{Client, Error, StatusCode};
use serde::Deserialize;
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use url::Url;

async fn fetch_bmcl_forge_universal_url(
  root: Url,
  game_version: &str,
  loader_ver: &str,
) -> Result<String, Error> {
  let client = Client::builder().redirect(Policy::limited(5)).build()?;

  let response = client
    .get(root.clone())
    .query(&[
      ("mcversion", game_version),
      ("version", loader_ver),
      ("category", "client"),
      ("format", "zip"),
    ])
    .send()
    .await?;

  if response.status() == StatusCode::NOT_FOUND {
    let response = client
      .get(root)
      .query(&[
        ("mcversion", game_version),
        ("version", loader_ver),
        ("category", "universal"),
        ("format", "zip"),
      ])
      .send()
      .await?;
    Ok(response.url().to_string())
  } else {
    Ok(response.url().to_string())
  }
}

pub async fn install_universal_forge_loader(
  priority: &[SourceType],
  game_version: &str,
  loader: &ModLoader,
  lib_dir: PathBuf,
  task_params: &mut Vec<PTaskParam>,
) -> SJMCLResult<()> {
  let loader_ver = &loader.version;

  let mut universal_url_opt: Option<Url> = None;
  for source_type in priority.iter() {
    if let Ok(root) = get_download_api(*source_type, ResourceType::ForgeInstall) {
      let url_res: SJMCLResult<Url> = match source_type {
        SourceType::Official => {
          let full_ver = vec![game_version, loader_ver.as_str()]
            .into_iter()
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("-");

          let client = Client::builder()
            .redirect(Policy::limited(5))
            .build()
            .map_err(|e| SJMCLError(e.to_string()))?;

          let response = client
            .get(root.join(&format!("{full_ver}/forge-{full_ver}-client.zip"))?)
            .send()
            .await
            .map_err(|e| SJMCLError(e.to_string()))?;

          let status = response.status();
          if status == StatusCode::NOT_FOUND {
            Ok(root.join(&format!("{full_ver}/forge-{full_ver}-universal.zip"))?)
          } else {
            Ok(root.join(&format!("{full_ver}/forge-{full_ver}-client.zip"))?)
          }
        }
        SourceType::BMCLAPIMirror => {
          let s = fetch_bmcl_forge_universal_url(root, game_version, loader_ver)
            .await
            .map_err(|e| SJMCLError(e.to_string()))?;
          Ok(Url::parse(&s)?)
        }
      };
      if let Ok(url) = url_res {
        universal_url_opt = Some(url);
        break;
      }
    }
  }

  let universal_url = universal_url_opt
    .ok_or_else(|| SJMCLError("failed to resolve Forge universal URL".to_string()))?;

  let universal_coord = format!("net.minecraftforge:forge:{}", loader.version);
  let universal_rel = convert_library_name_to_path(&universal_coord, None)?;
  let universal_path = lib_dir.join(&universal_rel);

  task_params.push(PTaskParam::Download(DownloadParam {
    src: universal_url,
    dest: universal_path.clone(),
    filename: None,
    sha1: None,
  }));

  Ok(())
}

pub async fn download_universal_forge_libraries(
  app: &AppHandle,
  priority: &[SourceType],
  instance: &Instance,
  client_info: &mut McClientInfo,
) -> SJMCLResult<()> {
  let subdirs = get_instance_subdir_paths(
    app,
    instance,
    &[&InstanceSubdirType::Root, &InstanceSubdirType::Libraries],
  )
  .ok_or(InstanceError::InvalidSourcePath)?;

  let [root_dir, lib_dir] = subdirs.as_slice() else {
    return Err(InstanceError::InvalidSourcePath.into());
  };

  let version = instance.mod_loader.version.clone();
  let universal_coord = format!("net.minecraftforge:forge:{version}");
  let universal_rel = convert_library_name_to_path(&universal_coord, None)?;
  let universal_path = lib_dir.join(&universal_rel);

  if !universal_path.exists() {
    return Err(InstanceError::LoaderInstallerNotFound.into());
  }

  client_info.patches.push(McClientInfo {
    id: "forge".to_string(),
    version: Some(version.clone()),
    priority: Some(30000),
    libraries: vec![LibrariesValue {
      name: universal_coord.clone(),
      downloads: Default::default(),
      natives: Default::default(),
      extract: Default::default(),
      rules: Default::default(),
    }],
    ..Default::default()
  });

  let mut task_params = vec![];

  let path = get_app_resource_filepath(app, "assets/game/fmllibs.json")?;
  let txt =
    fs::read_to_string(&path).map_err(|e| SJMCLError(format!("read fmllibs.json failed: {e}")))?;
  let map: HashMap<String, Vec<FMLLib>> = serde_json::from_str(&txt)
    .map_err(|e| SJMCLError(format!("parse fmllibs.json failed: {e}")))?;

  let forge_version = &instance.mod_loader.version;

  let mut libs: &Vec<FMLLib> = &vec![];
  if forge_version.starts_with("4.") {
    libs = map.get("1.3.x").unwrap();
  } else if forge_version.starts_with("6.") || forge_version.starts_with("5.") {
    libs = map.get("1.4.x").unwrap();
  } else if forge_version.starts_with("7.7.0.5") {
    libs = map.get("1.5").unwrap();
  } else if forge_version.starts_with("7.7.0.6")
    || forge_version.starts_with("7.7.1.")
    || forge_version.starts_with("7.7.2.")
  {
    libs = map.get("1.5.1").unwrap();
  } else if forge_version.starts_with("7.8.") {
    libs = map.get("1.5.2").unwrap();
  }

  for lib in libs {
    task_params.push(PTaskParam::Download(DownloadParam {
      src: Url::parse(
        format!("https://files.prismlauncher.org/fmllibs/{}", lib.filename).as_str(),
      )?,
      dest: root_dir.join("libs").join(&lib.filename),
      filename: None,
      sha1: lib.checksum.clone(),
    }));

    task_params.push(PTaskParam::Download(DownloadParam {
      src: Url::parse(
        format!("https://files.prismlauncher.org/fmllibs/{}", lib.filename).as_str(),
      )?,
      dest: lib_dir.join("..").join("libs").join(&lib.filename),
      filename: None,
      sha1: lib.checksum.clone(),
    }));
  }

  let mut seen = std::collections::HashSet::new();
  task_params.retain(|param| match param {
    PTaskParam::Download(dp) => seen.insert(dp.dest.clone()),
  });

  schedule_progressive_task_group(
    app.clone(),
    format!("forge-libraries?{}", instance.id),
    task_params,
    true,
  )
  .await?;

  reset_fields_from_patches(client_info);

  Ok(())
}

#[derive(Debug, Deserialize, Clone)]
pub struct FMLLib {
  pub filename: String,
  pub checksum: Option<String>,
}
