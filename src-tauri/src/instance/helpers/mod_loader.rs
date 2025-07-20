use super::super::super::launch::helpers::file_validator::convert_library_name_to_path;
use reqwest::redirect::Policy;
use reqwest::{Client, Error};
use std::cmp::Ordering;
use std::fs;
use std::fs::File;
use std::io::Read;
use std::path::PathBuf;
use tauri_plugin_http::reqwest;
use zip::ZipArchive;

use crate::instance::helpers::client_json::{
  FeaturesInfo, IsAllowed, LaunchArgumentTemplate, LibrariesValue, McClientInfo, PatchesInfo,
};
use crate::instance::helpers::misc::get_instance_subdir_paths;
use crate::instance::models::misc::{Instance, InstanceError, InstanceSubdirType};
use crate::{
  error::{SJMCLError, SJMCLResult},
  instance::helpers::game_version::compare_game_versions,
  instance::models::misc::{ModLoader, ModLoaderType},
  resource::{
    helpers::misc::get_download_api,
    models::{ResourceType, SourceType},
  },
  tasks::{commands::schedule_progressive_task_group, download::DownloadParam, PTaskParam},
};
use tauri::{AppHandle, State};

pub fn add_library_entry(
  libraries: &mut Vec<LibrariesValue>,
  lib_path: &str,
  params: Option<LibrariesValue>,
) -> SJMCLResult<()> {
  let (group, artifact, _version) = {
    let parts: Vec<_> = lib_path.split(':').collect();
    (parts[0], parts[1], parts[2])
  };

  let key_prefix = format!("{}:{}", group, artifact);

  if let Some(pos) = libraries
    .iter()
    .position(|item| item.name.starts_with(&key_prefix))
  {
    libraries[pos] = LibrariesValue {
      name: lib_path.to_string(),
      ..params.unwrap_or_default()
    }
  } else {
    libraries.push(LibrariesValue {
      name: lib_path.to_string(),
      ..params.unwrap_or_default()
    });
  }

  Ok(())
}

pub fn convert_client_info_to_patch(client_info: &McClientInfo) -> PatchesInfo {
  PatchesInfo {
    id: "game".to_string(),
    version: client_info.id.clone(),
    priority: 0,
    arguments: client_info.arguments.clone().unwrap_or_default(),
    main_class: client_info.main_class.clone(),
    asset_index: client_info.asset_index.clone(),
    assets: client_info.assets.clone(),
    libraries: client_info.libraries.clone(),
    downloads: client_info.downloads.clone(),
    logging: client_info.logging.clone(),
    java_version: Some(client_info.java_version.clone()),
    type_: client_info.type_.clone(),
    time: client_info.time.clone(),
    release_time: client_info.release_time.clone(),
    minimum_launcher_version: client_info.minimum_launcher_version,
    inherits_from: None,
  }
}

async fn fetch_forge_installer_url(
  game_version: &str,
  loader_ver: &str,
  branch: Option<&str>,
) -> Result<String, Error> {
  let client = Client::builder().redirect(Policy::limited(5)).build()?;

  let url = format!(
        "https://bmclapi2.bangbang93.com/forge/download?mcversion={game_version}&version={loader_ver}&branch={branch}&category=installer&format=jar",
        game_version = game_version,
        loader_ver = loader_ver,
        branch = branch.unwrap_or("")
    );

  let response = client.get(&url).send().await?;

  let final_url = response.url().to_string();
  Ok(final_url)
}

pub async fn install_mod_loader(
  app: AppHandle,
  client: State<'_, reqwest::Client>,
  priority: &[SourceType],
  game_version: &str,
  loader: &ModLoader,
  lib_dir: PathBuf,
  client_info: &mut McClientInfo,
) -> SJMCLResult<()> {
  match loader.loader_type {
    ModLoaderType::Fabric => {
      install_fabric_loader(
        app,
        client,
        priority,
        game_version,
        loader,
        lib_dir,
        client_info,
      )
      .await
    }
    ModLoaderType::Forge => {
      install_forge_loader(app, priority, game_version, loader, lib_dir).await
    }
    ModLoaderType::NeoForge => install_neoforge_loader(app, priority, loader, lib_dir).await,
    _ => Err(InstanceError::UnsupportedModLoader.into()),
  }
}

async fn install_fabric_loader(
  app: AppHandle,
  client: State<'_, reqwest::Client>,
  priority: &[SourceType],
  game_version: &str,
  loader: &ModLoader,
  lib_dir: PathBuf,
  client_info: &mut McClientInfo,
) -> SJMCLResult<()> {
  let loader_ver = &loader.version;

  client_info
    .patches
    .push(convert_client_info_to_patch(client_info));

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

  let mut task_params: Vec<PTaskParam> = Vec::new();

  let mut push_task = |coord: &str, url_root: &str| -> SJMCLResult<()> {
    let rel: String = convert_library_name_to_path(&coord.to_string(), None)?;
    let src = url::Url::parse(url_root)?.join(&rel)?;
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
  schedule_progressive_task_group(
    app,
    format!("fabric-loader?{loader_ver}"),
    task_params,
    true,
  )
  .await?;

  Ok(())
}

async fn install_neoforge_loader(
  app: AppHandle,
  priority: &[SourceType],
  loader: &ModLoader,
  lib_dir: PathBuf,
) -> SJMCLResult<()> {
  let loader_ver = &loader.version;

  let root = get_download_api(priority[0], ResourceType::NeoforgeInstall)?;

  let installer_url = match priority.first().unwrap_or(&SourceType::Official) {
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
  };

  let installer_coord = format!("net.neoforged:neoforge:{}-installer", loader.version);
  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = lib_dir.join(&installer_rel);

  schedule_progressive_task_group(
    app,
    format!("neoforge-installer?{loader_ver}"),
    vec![PTaskParam::Download(DownloadParam {
      src: installer_url,
      dest: installer_path,
      filename: None,
      sha1: None,
    })],
    true,
  )
  .await?;

  Ok(())
}

async fn install_forge_loader(
  app: AppHandle,
  priority: &[SourceType],
  game_version: &str,
  loader: &ModLoader,
  lib_dir: PathBuf,
) -> SJMCLResult<()> {
  let loader_ver = &loader.version;

  let root = get_download_api(priority[0], ResourceType::ForgeInstall)?;

  let installer_url = match priority.first().unwrap_or(&SourceType::Official) {
    SourceType::Official => {
      let path = if loader.branch.is_some() {
        format!(
          "{mc_ver}-{fg_ver}-{branch}/forge-{mc_ver}-{fg_ver}-{branch}-installer.jar",
          mc_ver = game_version,
          fg_ver = loader_ver,
          branch = loader.branch.as_deref().unwrap_or("main")
        )
      } else {
        format!(
          "{mc_ver}-{fg_ver}/forge-{mc_ver}-{fg_ver}-installer.jar",
          mc_ver = game_version,
          fg_ver = loader_ver,
        )
      };
      root.join(&path)?
    }
    SourceType::BMCLAPIMirror => url::Url::parse(
      &fetch_forge_installer_url(game_version, loader_ver, loader.branch.as_deref()).await?,
    )?,
  };

  let installer_coord = format!("net.minecraftforge:forge:{}-installer", loader.version);
  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = lib_dir.join(&installer_rel);

  schedule_progressive_task_group(
    app,
    format!("forge-installer?{loader_ver}"),
    vec![PTaskParam::Download(DownloadParam {
      src: installer_url,
      dest: installer_path,
      filename: None,
      sha1: None,
    })],
    true,
  )
  .await?;

  Ok(())
}

pub async fn download_forge_libraries(
  app: AppHandle,
  instance: &Instance,
  client_info: &McClientInfo,
) -> SJMCLResult<()> {
  let subdirs = get_instance_subdir_paths(&app, instance, &[&InstanceSubdirType::Libraries])
    .ok_or(InstanceError::InvalidSourcePath)?;
  let lib_dir = subdirs[0].clone();

  let mut client_info = client_info.clone();

  client_info
    .patches
    .push(convert_client_info_to_patch(&client_info));

  let installer_coord = format!(
    "net.minecraftforge:forge:{}-installer",
    instance.mod_loader.version
  );
  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = lib_dir.join(&installer_rel);
  let comparison = compare_game_versions(&app, &instance.version, "1.13").await;
  if comparison != Ordering::Less {
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
            } else {
              continue; // Skip non-maven files
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

    let profile_json: serde_json::Value = serde_json::from_str(&content)?;
    let forge_info: McClientInfo = serde_json::from_str(&version)?;

    let main_class = forge_info.main_class;
    client_info.main_class = main_class.to_string();

    let libraries: Vec<LibrariesValue> = serde_json::from_value(profile_json["libraries"].clone())
      .map_err(|_| InstanceError::InstallProfileParseError)?;

    let mut task_params = vec![];
    let feature = FeaturesInfo::default();

    for lib in forge_info.libraries.iter() {
      if !lib.is_allowed(&feature).unwrap_or(false) {
        continue;
      }

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

      task_params.push(PTaskParam::Download(DownloadParam {
        src: url::Url::parse(url)?,
        dest: lib_dir.join(&convert_library_name_to_path(name, None)?),
        filename: None,
        sha1: None,
      }));
    }

    let nf_args = forge_info
      .arguments
      .ok_or(InstanceError::ModLoaderVersionParseError)?;
    let v_args = client_info
      .arguments
      .clone()
      .ok_or(InstanceError::ClientJsonParseError)?;
    let new_args = LaunchArgumentTemplate {
      game: [nf_args.game, v_args.game].concat(),
      jvm: [nf_args.jvm, v_args.jvm].concat(),
    };
    client_info.arguments = Some(new_args.clone());
    let mut new_patch = PatchesInfo {
      id: "forge".to_string(),
      version: forge_info.id.clone(),
      priority: 30000,
      inherits_from: forge_info.inherits_from.clone(),
      main_class: main_class.clone(),
      arguments: new_args,
      ..Default::default()
    };

    for lib in libraries {
      if !lib.is_allowed(&feature).unwrap_or(false) {
        continue;
      }

      let name = &lib.name;
      let url = lib
        .downloads
        .as_ref()
        .and_then(|d| d.artifact.as_ref())
        .map_or("https://libraries.minecraft.net/", |a| a.url.as_str());

      add_library_entry(&mut client_info.libraries, name, Some(lib.clone()))?;
      add_library_entry(&mut new_patch.libraries, name, Some(lib.clone()))?;

      if url.is_empty() {
        continue;
      }

      let rel = convert_library_name_to_path(&name.to_string(), None)?;
      task_params.push(PTaskParam::Download(DownloadParam {
        src: url::Url::parse(url)?,
        dest: lib_dir.join(&rel),
        filename: None,
        sha1: None,
      }));
    }
    client_info.patches.push(new_patch.clone());

    schedule_progressive_task_group(
      app,
      format!("forge-libraries?{}", instance.id),
      task_params,
      true,
    )
    .await?;
  } else {
    let file = File::open(&installer_path)?;
    let mut archive = ZipArchive::new(file)?;

    let mut content = String::new();
    {
      let mut install_profile = archive.by_name("install_profile.json")?;
      install_profile.read_to_string(&mut content)?;
    }

    let profile_json: serde_json::Value = serde_json::from_str(&content)?;

    let main_class = profile_json["versionInfo"]["mainClass"].as_str().unwrap();
    let libraries = profile_json["versionInfo"]["libraries"].as_array().unwrap();

    client_info.main_class = main_class.to_string();

    let mut new_patch = PatchesInfo {
      id: "forge".to_string(),
      version: instance.mod_loader.version.clone(),
      priority: 30000,
      main_class: main_class.to_string(),
      inherits_from: Some(
        profile_json["versionInfo"]["inheritsFrom"]
          .as_str()
          .unwrap()
          .to_string(),
      ),
      arguments: LaunchArgumentTemplate {
        game: vec![],
        jvm: vec![],
      },
      release_time: profile_json["versionInfo"]["releaseTime"]
        .as_str()
        .ok_or(InstanceError::InstallProfileParseError)?
        .to_string(),
      time: profile_json["versionInfo"]["time"]
        .as_str()
        .ok_or(InstanceError::InstallProfileParseError)?
        .to_string(),
      type_: profile_json["versionInfo"]["type"]
        .as_str()
        .ok_or(InstanceError::InstallProfileParseError)?
        .to_string(),
      assets: profile_json["versionInfo"]["assets"]
        .as_str()
        .ok_or(InstanceError::InstallProfileParseError)?
        .to_string(),

      ..Default::default()
    };

    let install_arguments = profile_json["versionInfo"]["minecraftArguments"]
      .as_str()
      .ok_or(InstanceError::InstallProfileParseError)?;

    client_info.minecraft_arguments = Some(install_arguments.to_string());

    if let Some(first_lib) = libraries.first() {
      let name = first_lib["name"]
        .as_str()
        .ok_or(InstanceError::InstallProfileParseError)?;
      let _url = if first_lib["url"].is_null() {
        "https://libraries.minecraft.net/"
      } else {
        first_lib["url"]
          .as_str()
          .ok_or(InstanceError::InstallProfileParseError)?
      };

      add_library_entry(&mut client_info.libraries, name, None)?;
      add_library_entry(&mut new_patch.libraries, name, None)?;

      let rel = convert_library_name_to_path(&name.to_string(), None)?;

      let parts: Vec<&str> = name.split(':').collect();
      let artifact_id = parts[1];
      let version = parts[2];

      let file_name = format!("{}-{}-universal.jar", artifact_id, version);
      let mut file = archive.by_name(&file_name)?;
      let dest_path = lib_dir.join(&rel);

      if let Some(parent) = dest_path.parent() {
        if !parent.exists() {
          fs::create_dir_all(parent)?;
        }
      }

      let mut output = File::create(&dest_path)?;

      std::io::copy(&mut file, &mut output)?;
    } else {
      return Err(InstanceError::InstallProfileParseError.into());
    }

    let mut task_params = vec![];
    for lib in libraries.iter().skip(1) {
      let name = lib["name"]
        .as_str()
        .ok_or(SJMCLError("lib without name".to_string()))?;
      let url = if lib["url"].is_null() {
        "https://libraries.minecraft.net/"
      } else {
        lib["url"]
          .as_str()
          .ok_or(InstanceError::InstallProfileParseError)?
      };

      add_library_entry(&mut client_info.libraries, name, None)?;
      add_library_entry(&mut new_patch.libraries, name, None)?;

      let rel = convert_library_name_to_path(&name.to_string(), None)?;
      let src = url::Url::parse(url)?.join(&rel)?;
      task_params.push(PTaskParam::Download(DownloadParam {
        src,
        dest: lib_dir.join(&rel),
        filename: None,
        sha1: None,
      }));
    }
    client_info.patches.push(new_patch);

    schedule_progressive_task_group(
      app,
      format!("forge-libraries?{}", instance.id),
      task_params,
      true,
    )
    .await?;
  }

  let vjson_path = instance
    .version_path
    .join(format!("{}.json", instance.name));
  fs::write(vjson_path, serde_json::to_vec_pretty(&client_info)?)?;

  Ok(())
}

pub async fn download_neoforge_libraries(
  app: AppHandle,
  instance: &Instance,
  client_info: &McClientInfo,
) -> SJMCLResult<()> {
  let mut client_info = client_info.clone();
  client_info
    .patches
    .push(convert_client_info_to_patch(&client_info));

  let subdirs = get_instance_subdir_paths(&app, instance, &[&InstanceSubdirType::Libraries])
    .ok_or(InstanceError::InvalidSourcePath)?;
  let lib_dir = subdirs[0].clone();

  let installer_coord = format!(
    "net.neoforged:neoforge:{}-installer",
    instance.mod_loader.version
  );
  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = lib_dir.join(&installer_rel);
  let (content, version) = {
    let file = File::open(&installer_path)?;
    let mut archive = ZipArchive::new(file)?;

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

  let profile_json: serde_json::Value = serde_json::from_str(&content)?;
  let neoforge_info: McClientInfo = serde_json::from_str(&version)?;

  let main_class = neoforge_info.main_class;
  client_info.main_class = main_class.to_string();

  let libraries: Vec<LibrariesValue> = serde_json::from_value(profile_json["libraries"].clone())
    .map_err(|_| InstanceError::InstallProfileParseError)?;

  let mut task_params = vec![];
  let feature = FeaturesInfo::default();

  for lib in neoforge_info.libraries.iter() {
    if !lib.is_allowed(&feature).unwrap_or(false) {
      continue;
    }

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

    task_params.push(PTaskParam::Download(DownloadParam {
      src: url::Url::parse(url)?,
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
    game: [nf_args.game, v_args.game].concat(),
    jvm: [nf_args.jvm, v_args.jvm].concat(),
  };
  client_info.arguments = Some(new_args.clone());
  let mut new_patch = PatchesInfo {
    id: "neoforge".to_string(),
    version: neoforge_info.id.clone(),
    priority: 30000,
    inherits_from: neoforge_info.inherits_from.clone(),
    main_class: main_class.clone(),
    arguments: new_args,
    ..Default::default()
  };

  for lib in libraries {
    if !lib.is_allowed(&feature).unwrap_or(false) {
      continue;
    }
    let name = &lib.name;
    let url = lib
      .downloads
      .as_ref()
      .and_then(|d| d.artifact.as_ref())
      .map_or("https://libraries.minecraft.net/", |a| a.url.as_str());
    if url.is_empty() {
      continue;
    }
    println!("[neoforge] lib: {}, url: {}", name, url);

    add_library_entry(&mut client_info.libraries, name, Some(lib.clone()))?;
    add_library_entry(&mut new_patch.libraries, name, Some(lib.clone()))?;

    let rel = convert_library_name_to_path(&name.to_string(), None)?;
    task_params.push(PTaskParam::Download(DownloadParam {
      src: url::Url::parse(url)?,
      dest: lib_dir.join(&rel),
      filename: None,
      sha1: None,
    }));
  }
  client_info.patches.push(new_patch.clone());

  schedule_progressive_task_group(
    app,
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
