use cafebabe::constant_pool::{ConstantPoolItem, LiteralConstant};
use serde::{Deserialize, Serialize};
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use url::Url;
use zip::ZipArchive;

use crate::download::DownloadTask;
use crate::instance::helpers::client_json::{
  DownloadsArtifact, LibrariesDownloads, LibrariesValue, McClientInfo, reset_fields_from_patches,
};
use crate::instance::helpers::loader::common::{InstallPlan, add_library_entry};
use crate::instance::helpers::misc::get_instance_subdir_paths;
use crate::instance::models::misc::{Instance, InstanceError, InstanceSubdirType, ModLoader};
use crate::launch::helpers::file_validator::convert_library_name_to_path;
use crate::resource::helpers::loader_meta::forge::{ForgeFile, get_legacy_forge_file};
use crate::resource::helpers::misc::{get_download_api, get_download_urls};
use crate::resource::models::{ResourceType, SourceType};

fn get_forge_file_sources(
  priority: &[SourceType],
  game_version: &str,
  loader: &ModLoader,
  category: &str,
  format: &str,
) -> SJMCLResult<Vec<Url>> {
  let loader_ver = &loader.version;

  let mut sources = Vec::new();
  for source_type in priority.iter() {
    if let Ok(root) = get_download_api(*source_type, ResourceType::ForgeInstall) {
      let url = match source_type {
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
          root.join(&format!("{full_ver}/forge-{full_ver}-{category}.{format}"))?
        }
        SourceType::BMCLAPIMirror => {
          let mut url = root;
          url.query_pairs_mut().extend_pairs([
            ("mcversion", game_version),
            ("version", loader_ver.as_str()),
            ("branch", loader.branch.as_deref().unwrap_or("")),
            ("category", category),
            ("format", format),
          ]);
          url
        }
      };
      sources.push(url);
    }
  }

  if sources.is_empty() {
    return Err(SJMCLError("failed to resolve Forge installer URL".into()));
  }
  Ok(sources)
}

fn legacy_forge_coordinate(game_version: &str, loader: &ModLoader, file: &ForgeFile) -> String {
  format!(
    "net.minecraftforge:forge:{}-{}:{}@{}",
    game_version, loader.version, file.category, file.format
  )
}

pub async fn install_forge_loader(
  app: &AppHandle,
  priority: &[SourceType],
  game_version: &str,
  loader: &ModLoader,
  lib_dir: PathBuf,
  task_params: &mut Vec<DownloadTask>,
) -> SJMCLResult<()> {
  let legacy_file = get_legacy_forge_file(app, game_version, &loader.version).await?;
  let (category, format) = legacy_file
    .as_ref()
    .map(|file| (file.category.as_str(), file.format.as_str()))
    .unwrap_or(("installer", "jar"));
  let sources = get_forge_file_sources(priority, game_version, loader, category, format)?;

  let installer_coord = legacy_file
    .as_ref()
    .map(|file| legacy_forge_coordinate(game_version, loader, file))
    .unwrap_or_else(|| format!("net.minecraftforge:forge:{}-installer", loader.version));
  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = lib_dir.join(&installer_rel);

  task_params.push(DownloadTask {
    sources,
    dest: installer_path.clone(),
    filename: None,
    size: None,
    sha1: legacy_file.map(|file| file.hash),
  });

  Ok(())
}

pub async fn download_forge_libraries(
  app: &AppHandle,
  priority: &[SourceType],
  instance: &Instance,
  client_info: &mut McClientInfo,
) -> SJMCLResult<InstallPlan> {
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
  let mut processors = vec![];

  if let Some(file) =
    get_legacy_forge_file(app, &instance.version, &instance.mod_loader.version).await?
  {
    return prepare_legacy_forge(priority, instance, root_dir, lib_dir, client_info, &file);
  }

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
  if !installer_path.exists() {
    return Err(InstanceError::LoaderInstallerNotFound.into());
  }
  let file = File::open(&installer_path)?;
  let mut archive = ZipArchive::new(file)?;

  // Extract maven folder contents to lib_dir
  for i in 0..archive.len() {
    let mut file = archive.by_index(i)?;
    let path = file.mangled_name()?;
    let outpath = if path.starts_with("maven/") {
      // Remove "maven/" prefix and join with lib_dir
      let relative_path = path.strip_prefix("maven/").unwrap();
      lib_dir.join(relative_path)
    } else if path == *"data/client.lzma" {
      bin_patch.clone()
    } else {
      continue;
    };

    if file.is_file() {
      // Create parent directories if they don't exist
      if let Some(p) = outpath.parent()
        && !p.exists()
      {
        fs::create_dir_all(p)?;
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
      let value_client = if let Some(library) = value.client.strip_circumfix('[', ']') {
        lib_dir
          .join(convert_library_name_to_path(library, None)?)
          .to_string_lossy()
          .into_owned()
      } else {
        value.client.clone()
      };
      args_map.insert(format!("{{{key}}}"), value_client);
    }

    for processor in profile.processors.iter_mut() {
      if processor.args.contains(&"DOWNLOAD_MOJMAPS".to_string()) {
        if let Some(mojmaps) = args_map.get("{MOJMAPS}")
          && let Some(client_mappings) = client_info.downloads.get("client_mappings")
        {
          task_params.push(DownloadTask {
            sources: get_download_urls(
              &client_mappings.url.parse()?,
              &[ResourceType::Launcher],
              priority,
            )?,
            dest: lib_dir.join(mojmaps),
            filename: None,
            size: u64::try_from(client_mappings.size).ok(),
            sha1: Some(client_mappings.sha1.clone()),
          });
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
        if let Some(library) = arg.strip_circumfix('[', ']') {
          *arg = lib_dir
            .join(convert_library_name_to_path(library, None)?)
            .to_string_lossy()
            .into_owned();
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

    processors = profile.processors;

    let forge_info: McClientInfo = serde_json::from_str(&version)?;
    client_info.main_class = forge_info.main_class.clone();

    let mut loader_libraries = vec![];
    for lib in forge_info.libraries.iter() {
      let name = &lib.name;
      add_library_entry(&mut client_info.libraries, name, Some(lib.clone()))?;
      add_library_entry(&mut loader_libraries, name, Some(lib.clone()))?;

      let artifact = lib.downloads.as_ref().and_then(|d| d.artifact.as_ref());
      let Some(artifact) = artifact.filter(|artifact| !artifact.url.is_empty()) else {
        continue;
      };

      task_params.push(DownloadTask {
        sources: get_download_urls(
          &Url::parse(&artifact.url)?,
          &[
            ResourceType::ForgeMaven,
            ResourceType::ForgeMavenNew,
            ResourceType::Libraries,
          ],
          priority,
        )?,
        dest: lib_dir.join(&convert_library_name_to_path(name, None)?),
        filename: None,
        size: u64::try_from(artifact.size).ok(),
        sha1: Some(artifact.sha1.clone()).filter(|sha1| !sha1.is_empty()),
      });
    }

    let arguments = forge_info.arguments.clone();
    let minecraft_arguments = if arguments.is_some() {
      None
    } else {
      forge_info.minecraft_arguments.clone()
    };

    client_info.patches.push(McClientInfo {
      id: "forge".to_string(),
      version: Some(forge_info.id.clone()),
      priority: Some(30000),
      inherits_from: forge_info.inherits_from.clone(),
      main_class: forge_info.main_class.clone(),
      arguments,
      minecraft_arguments,
      libraries: loader_libraries,
      ..Default::default()
    });

    for lib in profile.libraries.iter() {
      let name = &lib.name;
      let artifact = lib.downloads.as_ref().and_then(|d| d.artifact.as_ref());

      let Some(artifact) = artifact.filter(|artifact| !artifact.url.is_empty()) else {
        continue;
      };

      let rel = convert_library_name_to_path(&name.to_string(), None)?;
      task_params.push(DownloadTask {
        sources: get_download_urls(
          &Url::parse(&artifact.url)?,
          &[
            ResourceType::ForgeMaven,
            ResourceType::ForgeMavenNew,
            ResourceType::Libraries,
          ],
          priority,
        )?,
        dest: lib_dir.join(&rel),
        filename: None,
        size: u64::try_from(artifact.size).ok(),
        sha1: Some(artifact.sha1.clone()).filter(|sha1| !sha1.is_empty()),
      });
    }
  } else {
    // It's legacy version Forge installer

    let profile: LegacyInstallProfile = serde_json::from_str(&install_profile)
      .map_err(|_| InstanceError::InstallProfileParseError)?;

    let main_class = profile.version_info.main_class;
    let libraries = profile.version_info.libraries;

    client_info.main_class = Some(main_class.clone());

    let mut new_patch = McClientInfo {
      id: "forge".to_string(),
      version: Some(instance.mod_loader.version.clone()),
      priority: Some(30000),
      main_class: Some(main_class.to_string()),
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
    if let Some(parent) = dest_path.parent()
      && !parent.exists()
    {
      fs::create_dir_all(parent)?;
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
        get_download_api(priority[0], ResourceType::Libraries)?
      } else {
        Url::parse(&lib.url.clone().unwrap())?
      };

      let rel = convert_library_name_to_path(&name, None)?;
      let sources = get_download_urls(
        &url.join(&rel)?,
        &[
          ResourceType::ForgeMaven,
          ResourceType::ForgeMavenNew,
          ResourceType::Libraries,
        ],
        priority,
      )?;
      task_params.push(DownloadTask {
        sources,
        dest: lib_dir.join(&rel),
        filename: None,
        size: None,
        sha1: None,
      });
    }
    client_info.patches.push(new_patch);
  }

  reset_fields_from_patches(client_info);

  let mut seen = std::collections::HashSet::new();
  task_params.retain(|param| seen.insert(param.dest.clone()));

  Ok(InstallPlan {
    tasks: task_params,
    processors,
  })
}

fn prepare_legacy_forge(
  priority: &[SourceType],
  instance: &Instance,
  root_dir: &Path,
  lib_dir: &Path,
  client_info: &mut McClientInfo,
  file: &ForgeFile,
) -> SJMCLResult<InstallPlan> {
  let name = legacy_forge_coordinate(&instance.version, &instance.mod_loader, file);
  let path = convert_library_name_to_path(&name, None)?;
  let archive_path = lib_dir.join(&path);
  if !archive_path.is_file() {
    return Err(InstanceError::LoaderInstallerNotFound.into());
  }
  let mut archive = ZipArchive::new(File::open(&archive_path)?)?;
  let tasks = get_legacy_fml_library_tasks(&mut archive, root_dir, priority)?;
  let sources = get_forge_file_sources(
    &[SourceType::Official],
    &instance.version,
    &instance.mod_loader,
    &file.category,
    &file.format,
  )?;

  // Pre-installer Forge overrides vanilla classes through the classpath, not processors.
  client_info.patches.push(McClientInfo {
    id: "forge".to_string(),
    version: Some(instance.mod_loader.version.clone()),
    priority: Some(30000),
    inherits_from: Some(instance.version.clone()),
    libraries: vec![LibrariesValue {
      name,
      downloads: Some(LibrariesDownloads {
        artifact: Some(DownloadsArtifact {
          path,
          url: sources[0].to_string(),
          sha1: file.hash.clone(),
          size: fs::metadata(&archive_path)?.len() as i64,
        }),
        ..Default::default()
      }),
      ..Default::default()
    }],
    ..Default::default()
  });
  reset_fields_from_patches(client_info);

  Ok(InstallPlan {
    tasks,
    processors: Vec::new(),
  })
}

fn get_legacy_fml_library_tasks(
  archive: &mut ZipArchive<File>,
  root_dir: &Path,
  priority: &[SourceType],
) -> SJMCLResult<Vec<DownloadTask>> {
  let mut bytes = Vec::new();
  match archive.by_name("cpw/mods/fml/relauncher/CoreFMLLibraries.class") {
    Ok(mut file) => {
      file.read_to_end(&mut bytes)?;
    }
    Err(zip::result::ZipError::FileNotFound) => return Ok(Vec::new()),
    Err(error) => return Err(error.into()),
  }
  let class = cafebabe::parse_class(&bytes).map_err(|_| InstanceError::InstallProfileParseError)?;
  let strings = class
    .constantpool_iter()
    .filter_map(|item| match item {
      ConstantPoolItem::LiteralConstant(LiteralConstant::String(value)) => Some(value.into_owned()),
      _ => None,
    })
    .collect::<Vec<_>>();

  // CoreFMLLibraries declares parallel filename/hash arrays in constant-pool order.
  let names = strings
    .iter()
    .filter(|value| value.ends_with(".jar") || value.ends_with(".zip"))
    .cloned()
    .collect::<Vec<_>>();
  let hashes = strings
    .iter()
    .filter(|value| value.len() == 40 && value.bytes().all(|byte| byte.is_ascii_hexdigit()))
    .cloned()
    .collect::<Vec<_>>();
  if names.len() != hashes.len() {
    return Err(InstanceError::InstallProfileParseError.into());
  }
  let mut libraries = names.into_iter().zip(hashes).collect::<Vec<_>>();
  let properties = java_properties::read(archive.by_name("fmlversion.properties")?)?;
  if let Some(hash) = properties.get("fmlbuild.deobfuscation.hash") {
    let version = properties
      .get("fmlbuild.mcversion")
      .ok_or(InstanceError::InstallProfileParseError)?;
    libraries.push((format!("deobfuscation_data_{version}.zip"), hash.clone()));
  }

  let base_url = get_download_api(SourceType::Official, ResourceType::ForgeFmlLibraries)?;
  libraries
    .into_iter()
    .map(|(name, hash)| {
      if !name
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte))
        || hash.len() != 40
        || !hash.bytes().all(|byte| byte.is_ascii_hexdigit())
      {
        return Err(InstanceError::InstallProfileParseError.into());
      }
      Ok(DownloadTask {
        sources: get_download_urls(
          &base_url.join(&name)?,
          &[ResourceType::ForgeFmlLibraries],
          priority,
        )?,
        dest: root_dir.join("lib").join(name),
        filename: None,
        size: None,
        sha1: Some(hash),
      })
    })
    .collect()
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
