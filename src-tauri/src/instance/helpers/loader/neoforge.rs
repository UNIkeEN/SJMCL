use std::collections::HashMap;
use std::fs;
use std::fs::File;
use std::io::Read;
use std::path::PathBuf;
use tauri::AppHandle;
use url::Url;
use zip::ZipArchive;

use super::{common::add_library_entry, forge::InstallProfile};
use crate::instance::helpers::client_json::{LaunchArgumentTemplate, McClientInfo, PatchesInfo};
use crate::instance::helpers::misc::get_instance_subdir_paths;
use crate::instance::models::misc::{Instance, InstanceError, InstanceSubdirType};
use crate::launch::helpers::file_validator::convert_library_name_to_path;
use crate::resource::helpers::misc::convert_url_to_target_source;
use crate::{
  error::SJMCLResult,
  instance::models::misc::ModLoader,
  resource::{
    helpers::misc::get_download_api,
    models::{ResourceType, SourceType},
  },
  tasks::{commands::schedule_progressive_task_group, download::DownloadParam, RuntimeTaskParam},
};

pub async fn install_neoforge_loader(
  priority: &[SourceType],
  loader: &ModLoader,
  lib_dir: PathBuf,
  task_params: &mut Vec<RuntimeTaskParam>,
) -> SJMCLResult<()> {
  let loader_ver = &loader.version;

  let (installer_url, installer_coord) = if loader_ver.starts_with("1.20.1-") {
    (
      get_download_api(SourceType::Official, ResourceType::NeoforgeInstall)?.join(&format!(
        "net/neoforged/forge/{v}/forge-{v}-installer.jar",
        v = loader_ver
      ))?,
      format!("net.neoforged:forge:{}-installer", loader.version),
    )
  } else {
    let root = get_download_api(priority[0], ResourceType::NeoforgeInstall)?;
    (
      match priority.first().unwrap_or(&SourceType::Official) {
        SourceType::Official => {
          let path = format!(
            "net/neoforged/neoforge/{v}/neoforge-{v}-installer.jar",
            v = loader_ver
          );
          root.join(&path)?
        }
        SourceType::BMCLAPIMirror => {
          let path = format!("{v}/download/installer", v = loader_ver);
          root.join(&path)?
        }
      },
      format!("net.neoforged:neoforge:{}-installer", loader.version),
    )
  };

  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = lib_dir.join(&installer_rel);

  task_params.push(RuntimeTaskParam::Download(DownloadParam {
    src: installer_url,
    dest: installer_path.clone(),
    filename: None,
    sha1: None,
  }));

  Ok(())
}

pub async fn download_neoforge_libraries(
  app: &AppHandle,
  priority: &[SourceType],
  instance: &Instance,
  client_info: &McClientInfo,
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
  let mut task_params = vec![];

  let mut client_info = client_info.clone();

  let name = if instance.mod_loader.version.starts_with("1.20.1-") {
    "forge"
  } else {
    "neoforge"
  };

  let installer_coord = format!(
    "net.neoforged:{name}:{}-installer",
    instance.mod_loader.version
  );
  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = lib_dir.join(&installer_rel);
  let bin_patch = lib_dir.join(convert_library_name_to_path(
    &format!(
      "net.neoforged:{name}:{}:clientdata@lzma",
      instance.mod_loader.version
    ),
    None,
  )?);
  let (content, version) = {
    let file = File::open(&installer_path)?;
    let mut archive = ZipArchive::new(file)?;

    // Extract maven folder contents to lib_dir
    for i in 0..archive.len() {
      let mut file = archive.by_index(i)?;
      let outpath = match file.enclosed_name() {
        Some(path) => {
          if path.starts_with("maven/") {
            // Remove "maven/" prefix and join with lib_dir
            let relative_path = path.strip_prefix("maven/").unwrap();
            lib_dir.join(relative_path)
          } else if path == PathBuf::from("data/client.lzma") {
            bin_patch.clone()
          } else {
            continue;
          }
        }
        None => continue,
      };

      if file.name().ends_with('/') {
        // Create directory
        fs::create_dir_all(&outpath)?;
      } else {
        // Create parent directories if they don't exist
        if let Some(p) = outpath.parent() {
          if !p.exists() {
            fs::create_dir_all(p)?;
          }
        }

        // Extract file
        let mut outfile = File::create(&outpath)?;
        std::io::copy(&mut file, &mut outfile)?;
      }
    }

    let mut s = String::new();
    {
      let mut install_profile = archive.by_name("install_profile.json")?;
      install_profile.read_to_string(&mut s)?;
    }

    let mut t = String::new();
    {
      let mut version_file = archive.by_name("version.json")?;
      version_file.read_to_string(&mut t)?;
    }

    (s, t)
  };

  let mut profile: InstallProfile = serde_json::from_str(&content)?;

  let mut args_map = HashMap::<String, String>::new();
  args_map.insert(
    "{MINECRAFT_JAR}".into(),
    instance
      .version_path
      .join(format!("{}.jar", instance.name))
      .to_string_lossy()
      .to_string(),
  );
  args_map.insert("{BINPATCH}".into(), bin_patch.to_string_lossy().to_string());
  args_map.insert(
    "{INSTALLER}".into(),
    installer_path.to_string_lossy().to_string(),
  );
  args_map.insert("{SIDE}".into(), "client".to_string());
  args_map.insert("{ROOT}".into(), root_dir.to_string_lossy().to_string());
  for (key, value) in profile.data.iter() {
    if args_map.contains_key(&format!("{{{key}}}")) {
      continue;
    }
    let mut value_client = value.client.clone();
    if value_client.starts_with('[') && value_client.ends_with(']') {
      value_client = value_client
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_string();
      value_client = lib_dir
        .join(convert_library_name_to_path(&value_client, None)?)
        .to_string_lossy()
        .to_string();
    }
    args_map.insert(format!("{{{key}}}"), value_client);
  }

  for processor in profile.processors.iter_mut() {
    if processor.args.contains(&"DOWNLOAD_MOJMAPS".to_string()) {
      if let Some(mojmaps) = args_map.get("{MOJMAPS}") {
        if let Some(client_mappings) = client_info.downloads.get("client_mappings") {
          task_params.push(RuntimeTaskParam::Download(DownloadParam {
            src: client_mappings.url.parse()?,
            dest: lib_dir.join(mojmaps),
            filename: None,
            sha1: Some(client_mappings.sha1.clone()),
          }));
        }
      }
      processor.args.clear();
      continue;
    }

    processor.jar = lib_dir
      .join(convert_library_name_to_path(&processor.jar, None)?)
      .to_string_lossy()
      .to_string();

    for class in processor.classpath.iter_mut() {
      *class = lib_dir
        .join(convert_library_name_to_path(class, None)?)
        .to_string_lossy()
        .to_string();
    }

    for arg in processor.args.iter_mut() {
      if arg.starts_with('[') && arg.ends_with(']') {
        *arg = arg
          .trim_start_matches('[')
          .trim_end_matches(']')
          .to_string();
        *arg = lib_dir
          .join(convert_library_name_to_path(arg, None)?)
          .to_string_lossy()
          .to_string();
      }
      for (key, value) in &args_map {
        *arg = arg.replace(key, value);
      }
    }
  }

  profile.processors.retain(|processor| {
    if let Some(sides) = &processor.sides {
      sides.contains(&"client".to_string())
    } else {
      !processor.args.is_empty()
    }
  });

  fs::write(
    instance.version_path.join("install_profile.json"),
    &serde_json::to_vec_pretty(&profile)?,
  )?;

  let neoforge_info: McClientInfo = serde_json::from_str(&version)?;

  let main_class = neoforge_info.main_class;
  client_info.main_class = main_class.to_string();

  for lib in neoforge_info.libraries.iter() {
    let name = &lib.name;
    add_library_entry(&mut client_info.libraries, name, Some(lib.clone()))?;

    let url = lib
      .downloads
      .as_ref()
      .and_then(|d| d.artifact.as_ref())
      .map(|a| a.url.as_str())
      .unwrap_or_default();
    if url.is_empty() {
      continue;
    }

    task_params.push(RuntimeTaskParam::Download(DownloadParam {
      src: convert_url_to_target_source(
        &Url::parse(url)?,
        &[ResourceType::NeoforgeMaven, ResourceType::Libraries],
        &priority[0],
      )?,
      dest: lib_dir.join(&convert_library_name_to_path(name, None)?),
      filename: None,
      sha1: None,
    }));
  }

  let nf_args = neoforge_info
    .arguments
    .ok_or(InstanceError::ModLoaderVersionParseError)?;
  let v_args = client_info
    .arguments
    .clone()
    .ok_or(InstanceError::ClientJsonParseError)?;
  let new_args = LaunchArgumentTemplate {
    game: [v_args.game, nf_args.game].concat(),
    jvm: [v_args.jvm, nf_args.jvm].concat(),
  };
  client_info.arguments = Some(new_args.clone());
  client_info.patches.push(PatchesInfo {
    id: "neoforge".to_string(),
    version: neoforge_info.id.clone(),
    priority: 30000,
    inherits_from: neoforge_info.inherits_from.clone(),
    main_class: main_class.clone(),
    arguments: Some(new_args.clone()),
    ..Default::default()
  });

  for lib in profile.libraries.iter() {
    let name = &lib.name;
    let url = lib
      .downloads
      .as_ref()
      .and_then(|d| d.artifact.as_ref())
      .map(|a| a.url.as_str())
      .unwrap_or("");

    if url.is_empty() {
      continue;
    }

    let rel = convert_library_name_to_path(&name.to_string(), None)?;
    task_params.push(RuntimeTaskParam::Download(DownloadParam {
      src: convert_url_to_target_source(
        &Url::parse(url)?,
        &[ResourceType::NeoforgeMaven, ResourceType::Libraries],
        &priority[0],
      )?,
      dest: lib_dir.join(&rel),
      filename: None,
      sha1: None,
    }));
  }

  schedule_progressive_task_group(
    app.clone(),
    format!("neoforge-libraries?{}", instance.id),
    task_params,
    true,
  )
  .await?;

  let vjson_path = instance
    .version_path
    .join(format!("{}.json", instance.name));
  fs::write(vjson_path, serde_json::to_vec_pretty(&client_info)?)?;
  Ok(())
}
