use reqwest::redirect::Policy;
use reqwest::{Client, Error};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::fs::File;
use std::io::Read;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_http::reqwest;
use url::Url;
use zip::ZipArchive;

use super::common::add_library_entry;
use crate::instance::helpers::client_json::{
  LaunchArgumentTemplate, LibrariesValue, McClientInfo, PatchesInfo,
};
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

async fn fetch_bmcl_forge_installer_url(
  root: Url,
  game_version: &str,
  loader_ver: &str,
  branch: Option<&str>,
) -> Result<String, Error> {
  let client = Client::builder().redirect(Policy::limited(5)).build()?;

  let response = client
    .get(root)
    .query(&[
      ("mcversion", game_version),
      ("version", loader_ver),
      ("branch", branch.unwrap_or("")),
      ("category", "installer"),
      ("format", "jar"),
    ])
    .send()
    .await?;

  let final_url = response.url().to_string();
  Ok(final_url)
}

pub async fn install_forge_loader(
  priority: &[SourceType],
  game_version: &str,
  loader: &ModLoader,
  lib_dir: PathBuf,
  task_params: &mut Vec<RuntimeTaskParam>,
) -> SJMCLResult<()> {
  let loader_ver = &loader.version;

  let root = get_download_api(priority[0], ResourceType::ForgeInstall)?;

  let installer_url = match priority.first().unwrap_or(&SourceType::Official) {
    SourceType::Official => {
      let full_ver = vec![
        game_version,
        loader_ver,
        loader.branch.as_ref().unwrap_or(&"".to_string()),
      ]
      .into_iter()
      .filter(|s| !s.is_empty())
      .collect::<Vec<_>>()
      .join("-");

      root.join(&format!("{full_ver}/forge-{full_ver}-installer.jar"))?
    }
    SourceType::BMCLAPIMirror => Url::parse(
      &fetch_bmcl_forge_installer_url(root, game_version, loader_ver, loader.branch.as_deref())
        .await?,
    )?,
  };

  let installer_coord = format!("net.minecraftforge:forge:{}-installer", loader.version);
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

pub async fn download_forge_libraries(
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

  let installer_coord = format!(
    "net.minecraftforge:forge:{}-installer",
    instance.mod_loader.version
  );
  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = lib_dir.join(&installer_rel);
  let bin_patch = lib_dir.join(convert_library_name_to_path(
    &format!(
      "net.minecraftforge:forge:{}:clientdata@lzma",
      instance.mod_loader.version
    ),
    None,
  )?);
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

    if file.is_file() {
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

  let (install_profile, version) = {
    let mut s = String::new();
    if let Ok(mut install_profile) = archive.by_name("install_profile.json") {
      install_profile.read_to_string(&mut s)?;
    }

    let mut t = String::new();
    if let Ok(mut version_file) = archive.by_name("version.json") {
      version_file.read_to_string(&mut t)?;
    }

    (s, t)
  };

  if install_profile.is_empty() {
    return Err(InstanceError::InstallProfileParseError.into());
  }

  if !version.is_empty() {
    // It's modern version Forge installer

    let mut profile: InstallProfile = serde_json::from_str(&install_profile)
      .map_err(|_| InstanceError::InstallProfileParseError)?;

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

    let forge_info: McClientInfo = serde_json::from_str(&version)?;

    let main_class = forge_info.main_class;
    client_info.main_class = main_class.to_string();

    for lib in forge_info.libraries.iter() {
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
          &[
            ResourceType::ForgeMaven,
            ResourceType::ForgeMavenNew,
            ResourceType::Libraries,
          ],
          &priority[0],
        )?,
        dest: lib_dir.join(&convert_library_name_to_path(name, None)?),
        filename: None,
        sha1: None,
      }));
    }

    let (arguments, minecraft_arguments) = if let Some(v_args) = client_info.arguments {
      let nf_args = forge_info
        .arguments
        .ok_or(InstanceError::ModLoaderVersionParseError)?;

      let new_args = LaunchArgumentTemplate {
        game: [v_args.game, nf_args.game].concat(),
        jvm: [v_args.jvm, nf_args.jvm].concat(),
      };
      (Some(new_args), None)
    } else {
      (None, forge_info.minecraft_arguments)
    };
    client_info.arguments = arguments.clone();
    client_info.minecraft_arguments = minecraft_arguments.clone();
    client_info.patches.push(PatchesInfo {
      id: "forge".to_string(),
      version: forge_info.id.clone(),
      priority: 30000,
      inherits_from: forge_info.inherits_from.clone(),
      main_class: main_class.clone(),
      arguments,
      minecraft_arguments,
      ..Default::default()
    });

    for lib in profile.libraries.iter() {
      let name = &lib.name;
      let url = lib
        .downloads
        .as_ref()
        .and_then(|d| d.artifact.as_ref())
        .map(|a| a.url.as_str())
        .unwrap_or_default();

      if url.is_empty() {
        continue;
      }

      let rel = convert_library_name_to_path(&name.to_string(), None)?;
      task_params.push(RuntimeTaskParam::Download(DownloadParam {
        src: convert_url_to_target_source(
          &Url::parse(url)?,
          &[
            ResourceType::ForgeMaven,
            ResourceType::ForgeMavenNew,
            ResourceType::Libraries,
          ],
          &priority[0],
        )?,
        dest: lib_dir.join(&rel),
        filename: None,
        sha1: None,
      }));
    }
  } else {
    // It's legacy version Forge installer

    let profile: LegacyInstallProfile = serde_json::from_str(&install_profile)
      .map_err(|_| InstanceError::InstallProfileParseError)?;

    let main_class = profile.version_info.main_class;
    let libraries = profile.version_info.libraries;

    client_info.main_class = main_class.to_string();

    let mut new_patch = PatchesInfo {
      id: "forge".to_string(),
      version: instance.mod_loader.version.clone(),
      priority: 30000,
      main_class: main_class.to_string(),
      inherits_from: Some(profile.version_info.inherits_from),
      arguments: None,
      minecraft_arguments: Some(profile.version_info.minecraft_arguments.clone()),
      release_time: profile.version_info.release_time,
      time: profile.version_info.time,
      type_: profile.version_info.type_,
      assets: profile.version_info.assets,

      ..Default::default()
    };

    client_info.minecraft_arguments = Some(profile.version_info.minecraft_arguments.clone());

    let mut file = archive.by_name(&profile.install.file_path)?;
    let dest_path = lib_dir.join(convert_library_name_to_path(&profile.install.path, None)?);
    if let Some(parent) = dest_path.parent() {
      if !parent.exists() {
        fs::create_dir_all(parent)?;
      }
    }
    let mut output = File::create(&dest_path)?;
    std::io::copy(&mut file, &mut output)?;

    for lib in libraries.iter() {
      let name = lib.name.clone();

      add_library_entry(&mut client_info.libraries, &name, None)?;
      add_library_entry(&mut new_patch.libraries, &name, None)?;

      if name == profile.install.path {
        continue;
      }

      let url = if lib.url.is_none() {
        continue;
      } else {
        lib.url.clone().unwrap()
      };

      let rel = convert_library_name_to_path(&name, None)?;
      let src = convert_url_to_target_source(
        &Url::parse(&url)?.join(&rel)?,
        &[
          ResourceType::ForgeMaven,
          ResourceType::ForgeMavenNew,
          ResourceType::Libraries,
        ],
        &priority[0],
      )?;
      task_params.push(RuntimeTaskParam::Download(DownloadParam {
        src,
        dest: lib_dir.join(&rel),
        filename: None,
        sha1: None,
      }));
    }
    client_info.patches.push(new_patch);
  }
  schedule_progressive_task_group(
    app.clone(),
    format!("forge-libraries?{}", instance.id),
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

#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstallProfileData {
  pub client: String,
  pub server: String,
}

#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProcessorsValue {
  pub sides: Option<Vec<String>>,
  pub jar: String,
  pub classpath: Vec<String>,
  pub args: Vec<String>,
  pub outputs: Option<HashMap<String, String>>,
}

#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstallProfile {
  pub spec: u64,
  pub profile: String,
  pub version: String,
  pub path: Option<String>,
  pub minecraft: String,
  pub data: HashMap<String, InstallProfileData>,
  pub processors: Vec<ProcessorsValue>,
  pub libraries: Vec<LibrariesValue>,
  pub json: String,
}

structstruck::strike! {
#[strikethrough[derive(Debug, Serialize, Deserialize, Default)]]
#[strikethrough[serde(rename_all = "camelCase", default)]]
pub struct LegacyInstallProfile {
  pub install: struct {
    pub path: String,
    pub version: String,
    pub file_path: String,
  },
  pub version_info: struct {
    pub id: String,
    pub time: String,
    pub release_time: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub minecraft_arguments: String,
    pub main_class: String,
    pub minimum_launcher_version: i32,
    pub assets: String,
    pub inherits_from: String,
    pub jar: String,
    pub libraries: Vec<LegacyLibrariesValue>
  }
}
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct LegacyLibrariesValue {
  pub name: String,
  pub url: Option<String>,
}
