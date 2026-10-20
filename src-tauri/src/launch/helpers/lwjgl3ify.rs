use sha1::{Digest, Sha1};
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::fs::{self, File};
use std::io::{BufReader, Read, Seek, Write};
use std::path::{Component, Path, PathBuf};
use tauri::AppHandle;
use zip::ZipArchive;

use crate::instance::helpers::client_json::{
  ArgumentsItem, DownloadsArtifact, JavaVersion, LibrariesValue, McClientInfo,
};
use crate::instance::helpers::misc::get_instance_subdir_paths;
use crate::instance::helpers::mods::common::discover_local_mod_paths;
use crate::instance::helpers::mods::legacy_forge::read_legacy_forge_mod_metadata;
use crate::instance::models::misc::{Instance, InstanceError, InstanceSubdirType, ModLoaderType};
use crate::launch::helpers::file_validator::{convert_library_name_to_path, merge_library_lists};
use crate::launch::models::LaunchError;
use crate::launcher_config::models::GameConfig;
use crate::utils::fs::validate_sha1;

const RESOURCE_ROOT: &str = "me/eigenraven/lwjgl3ify/relauncher/";
const SUPPORTED_VERSION: &str = "3.0.37";
const RFB_MAIN: &str = "com.gtnewhorizons.retrofuturabootstrap.MainStartOnFirstThread";
const RFB_LOADER: &str =
  "-Djava.system.class.loader=com.gtnewhorizons.retrofuturabootstrap.RfbSystemClassLoader";

// Only runtime preparation data: never persisted into the instance's version JSON.
#[derive(Debug, Clone)]
pub struct Lwjgl3ifyLaunchInfo {
  mod_path: PathBuf,
  mod_sha1: String,
  patch: DownloadsArtifact,
}

fn compatibility_error(error: LaunchError, reason: impl std::fmt::Display) -> SJMCLError {
  log::error!("lwjgl3ify: {reason}");
  error.into()
}

pub async fn resolve_lwjgl3ify(
  app: &AppHandle,
  instance: &Instance,
  game_config: &GameConfig,
  client_info: &mut McClientInfo,
) -> SJMCLResult<Option<Lwjgl3ifyLaunchInfo>> {
  if instance.version != "1.7.10"
    || !matches!(
      instance.mod_loader.loader_type,
      ModLoaderType::Forge | ModLoaderType::LegacyForge
    )
  {
    return Ok(None);
  }
  let dirs = get_instance_subdir_paths(app, instance, &[&InstanceSubdirType::Mods])
    .ok_or(InstanceError::InstanceNotFoundByID)?;
  let mods_dir = dirs[0].clone();
  let loader_type = instance.mod_loader.loader_type;
  let detected =
    tokio::task::spawn_blocking(move || find_lwjgl3ify(&mods_dir, loader_type)).await??;
  let Some((info, profile)) = detected else {
    return Ok(None);
  };
  validate_custom_jvm_arguments(&game_config.advanced.jvm.args)?;
  apply_profile(client_info, profile)?;
  log::info!("Using native launcher support for lwjgl3ify {SUPPORTED_VERSION}");
  Ok(Some(info))
}

fn read_entry<R: Read + Seek>(
  jar: &mut ZipArchive<R>,
  name: &str,
  limit: u64,
) -> SJMCLResult<Vec<u8>> {
  let mut entry = jar.by_name(name)?;
  if entry.size() > limit {
    return Err(SJMCLError(format!("Oversized lwjgl3ify resource: {name}")));
  }
  let mut contents = Vec::new();
  entry.by_ref().take(limit + 1).read_to_end(&mut contents)?;
  if contents.len() as u64 > limit {
    return Err(SJMCLError(format!("Oversized lwjgl3ify resource: {name}")));
  }
  Ok(contents)
}

fn file_sha1(path: &Path) -> SJMCLResult<String> {
  let mut file = File::open(path)?;
  let mut digest = Sha1::new();
  std::io::copy(&mut file, &mut digest)?;
  Ok(format!("{:x}", digest.finalize()))
}

fn find_lwjgl3ify(
  mods_dir: &Path,
  loader_type: ModLoaderType,
) -> SJMCLResult<Option<(Lwjgl3ifyLaunchInfo, McClientInfo)>> {
  let mut found = Vec::new();
  for path in discover_local_mod_paths(mods_dir, Some(loader_type)) {
    if path
      .extension()
      .and_then(|ext| ext.to_str())
      .is_some_and(|ext| ext.eq_ignore_ascii_case("disabled"))
    {
      continue;
    }
    // Forge only searches its version-specific child directory, not arbitrary folders.
    if path.parent() != Some(mods_dir)
      && path
        .parent()
        .and_then(Path::file_name)
        .is_none_or(|name| name != "1.7.10")
    {
      continue;
    }
    let metadata = (|| -> SJMCLResult<_> {
      let mut jar = ZipArchive::new(BufReader::new(File::open(&path)?))?;
      let bytes = read_entry(&mut jar, "mcmod.info", 1024 * 1024)?;
      read_legacy_forge_mod_metadata(bytes.as_slice())
    })();
    if let Ok(mods) = metadata {
      for metadata in mods {
        if metadata.modid == "lwjgl3ify" {
          found.push((path.clone(), metadata.version.unwrap_or_default()));
        }
      }
    }
  }
  if found.len() > 1 {
    return Err(compatibility_error(
      LaunchError::Lwjgl3ifyDuplicateMods,
      "Multiple enabled copies",
    ));
  }
  let Some((mod_path, version)) = found.pop() else {
    return Ok(None);
  };
  if version != SUPPORTED_VERSION {
    log::warn!(
      "Native lwjgl3ify support does not cover version {version}; using the original launch path"
    );
    return Ok(None);
  }
  let mut jar = ZipArchive::new(BufReader::new(File::open(&mod_path)?))?;
  let profile = (|| -> SJMCLResult<McClientInfo> {
    let bytes = read_entry(
      &mut jar,
      &format!("{RESOURCE_ROOT}version.json"),
      2 * 1024 * 1024,
    )?;
    Ok(serde_json::from_slice(&bytes)?)
  })()
  .map_err(|error| compatibility_error(LaunchError::Lwjgl3ifyInvalidMetadata, error.0))?;
  let patch_name = format!("com.github.GTNewHorizons:lwjgl3ify:{version}:forgePatches");
  let mut patch = profile
    .libraries
    .iter()
    .find(|library| library.name == patch_name)
    .and_then(|library| library.downloads.as_ref()?.artifact.clone())
    .ok_or_else(|| {
      compatibility_error(
        LaunchError::Lwjgl3ifyInvalidMetadata,
        "Missing forgePatches artifact",
      )
    })?;
  patch.path = safe_library_path(&patch_name, None)?;
  if patch.sha1.len() != 40 || !patch.sha1.bytes().all(|byte| byte.is_ascii_hexdigit()) {
    return Err(compatibility_error(
      LaunchError::Lwjgl3ifyInvalidMetadata,
      "Invalid forgePatches hash",
    ));
  }
  let info = Lwjgl3ifyLaunchInfo {
    mod_sha1: file_sha1(&mod_path)?,
    mod_path,
    patch,
  };
  Ok(Some((info, profile)))
}

fn safe_library_path(name: &str, classifier: Option<String>) -> SJMCLResult<String> {
  if name
    .split(':')
    .any(|part| part.is_empty() || part.contains(['/', '\\']) || part == "..")
  {
    return Err(compatibility_error(
      LaunchError::Lwjgl3ifyInvalidMetadata,
      "Invalid Maven coordinate",
    ));
  }
  let path = convert_library_name_to_path(name, classifier)?;
  if !Path::new(&path)
    .components()
    .all(|part| matches!(part, Component::Normal(_)))
  {
    return Err(compatibility_error(
      LaunchError::Lwjgl3ifyInvalidMetadata,
      "Invalid library path",
    ));
  }
  Ok(path)
}

fn platform_name(os: &str, arch: &str) -> SJMCLResult<String> {
  let base = match os {
    "windows" | "linux" => os,
    "macos" => "osx",
    _ => return Err(LaunchError::Lwjgl3ifyUnsupportedPlatform.into()),
  };
  Ok(match arch {
    "x86_64" => base.to_string(),
    "aarch64" => format!("{base}-arm64"),
    _ => return Err(LaunchError::Lwjgl3ifyUnsupportedPlatform.into()),
  })
}

// The bundled profile uses lwjgl3ify's extended OS names and ordered rule semantics.
// Evaluate these here without changing SJMCL's interpretation of other instances.
fn profile_library_allowed(library: &LibrariesValue, platform: &str) -> SJMCLResult<bool> {
  let mut allowed = library.rules.is_empty();
  for rule in &library.rules {
    if let Some(os) = &rule.os {
      if os.name != platform {
        continue;
      }
      if os.arch.is_some() || os.version.is_some() || rule.features.is_some() {
        return Err(LaunchError::Lwjgl3ifyInvalidMetadata.into());
      }
    }
    allowed = match rule.action.as_str() {
      "allow" => true,
      "disallow" => false,
      _ => return Err(LaunchError::Lwjgl3ifyInvalidMetadata.into()),
    };
  }
  Ok(allowed)
}

fn validate_custom_jvm_arguments(arguments: &str) -> SJMCLResult<()> {
  // Match command_generator's existing tokenization, including Windows backslashes.
  let arguments = arguments
    .split_whitespace()
    .map(str::to_string)
    .collect::<Vec<_>>();
  validate_jvm_values(&arguments, false)
}

fn validate_jvm_values(arguments: &[String], allow_managed_classpath: bool) -> SJMCLResult<()> {
  for (index, argument) in arguments.iter().enumerate() {
    if allow_managed_classpath && argument == "--class-path=${classpath}" {
      continue;
    }
    if allow_managed_classpath
      && matches!(argument.as_str(), "-cp" | "-classpath" | "--class-path")
      && arguments
        .get(index + 1)
        .is_some_and(|value| value == "${classpath}")
    {
      continue;
    }
    if (argument.starts_with("-Djava.system.class.loader=") && argument != RFB_LOADER)
      || matches!(
        argument.as_str(),
        "-cp" | "-classpath" | "--class-path" | "-jar"
      )
      || argument.starts_with("--class-path=")
    {
      return Err(LaunchError::Lwjgl3ifyConflictingArguments.into());
    }
  }
  Ok(())
}

fn apply_profile(client_info: &mut McClientInfo, mut profile: McClientInfo) -> SJMCLResult<()> {
  let platform = platform_name(std::env::consts::OS, std::env::consts::ARCH)?;
  if profile.main_class.as_deref() != Some(RFB_MAIN)
    || !profile.arguments.as_ref().is_some_and(|args| {
      args
        .jvm
        .iter()
        .any(|arg| arg.value.iter().any(|v| v == RFB_LOADER))
    })
  {
    return Err(LaunchError::Lwjgl3ifyInvalidMetadata.into());
  }
  if client_info.main_class.as_deref().is_some_and(|main| {
    !matches!(
      main,
      "net.minecraft.launchwrapper.Launch" | "com.gtnewhorizons.retrofuturabootstrap.Main"
    ) && main != RFB_MAIN
  }) {
    return Err(LaunchError::Lwjgl3ifyConflictingArguments.into());
  }
  if client_info.libraries.iter().any(|lib| {
    lib.name.starts_with("net.minecraftforge:forge:") && !lib.name.contains("10.13.4.1614")
  }) {
    return Err(compatibility_error(
      LaunchError::Lwjgl3ifyConflictingArguments,
      "The bundled patches require Forge 10.13.4.1614",
    ));
  }

  let mut libraries = Vec::new();
  for mut library in profile.libraries {
    if !profile_library_allowed(&library, &platform)? {
      continue;
    }
    library.rules.clear();
    let path = safe_library_path(&library.name, None)?;
    let downloads = library
      .downloads
      .as_mut()
      .ok_or(LaunchError::Lwjgl3ifyInvalidMetadata)?;
    if let Some(artifact) = &mut downloads.artifact {
      artifact.path = path;
    }
    if let Some(classifiers) = &mut downloads.classifiers {
      for (classifier, artifact) in classifiers {
        artifact.path = safe_library_path(&library.name, Some(classifier.clone()))?;
      }
    }
    libraries.push(library);
  }
  let patch_index = libraries
    .iter()
    .position(|lib| lib.name.ends_with(":forgePatches"))
    .ok_or(LaunchError::Lwjgl3ifyInvalidMetadata)?;
  let patch = libraries.remove(patch_index);
  libraries.insert(0, patch);
  let existing = client_info
    .libraries
    .iter()
    .filter(|lib| {
      !lib.name.starts_with("org.lwjgl.lwjgl:")
        && !lib.name.starts_with("com.github.GTNewHorizons:lwjgl3ify:")
    })
    .cloned()
    .collect::<Vec<_>>();
  libraries = merge_library_lists(&libraries, &existing);

  let mut arguments = profile
    .arguments
    .take()
    .ok_or(LaunchError::Lwjgl3ifyInvalidMetadata)?;
  let old_arguments = client_info.arguments.clone();
  if let Some(old) = &old_arguments {
    let values = old
      .jvm
      .iter()
      .flat_map(|argument| argument.value.iter().cloned())
      .collect::<Vec<_>>();
    validate_jvm_values(&values, true)?;
    let mut skip_classpath_value = false;
    let extra = old
      .jvm
      .iter()
      .cloned()
      .filter_map(|mut arg| {
        arg.value.retain(|value| {
          if skip_classpath_value {
            skip_classpath_value = false;
            return false;
          }
          if matches!(value.as_str(), "-cp" | "-classpath" | "--class-path") {
            skip_classpath_value = true;
            return false;
          }
          value != "--class-path=${classpath}"
        });
        (!arg.value.is_empty()).then_some(arg)
      })
      .filter(|arg| {
        !arguments
          .jvm
          .iter()
          .any(|existing| serde_json::to_value(existing).ok() == serde_json::to_value(arg).ok())
      })
      .collect::<Vec<_>>();
    arguments.jvm.extend(extra);
  }
  let mut game = if let Some(old) = old_arguments.filter(|args| !args.game.is_empty()) {
    old.game
  } else if let Some(legacy) = &client_info.minecraft_arguments {
    shlex::split(legacy)
      .ok_or(LaunchError::Lwjgl3ifyConflictingArguments)?
      .into_iter()
      .map(|value| ArgumentsItem {
        value: vec![value],
        ..Default::default()
      })
      .collect()
  } else {
    arguments.game.clone()
  };
  for argument in &arguments.game {
    if !argument.rules.is_empty()
      && !argument
        .value
        .iter()
        .any(|value| value.starts_with("--") && game.iter().any(|old| old.value.contains(value)))
    {
      game.push(argument.clone());
    }
  }
  if !game.iter().any(|arg| {
    arg
      .value
      .iter()
      .any(|value| value == "cpw.mods.fml.common.launcher.FMLTweaker")
  }) {
    game.push(ArgumentsItem {
      value: vec![
        "--tweakClass".to_string(),
        "cpw.mods.fml.common.launcher.FMLTweaker".to_string(),
      ],
      ..Default::default()
    });
  }
  arguments.game = game;
  client_info.main_class = profile.main_class;
  client_info.libraries = libraries;
  client_info.arguments = Some(arguments);
  // 25 is the recommendation in this bundled profile; the supported runtime floor is 17.
  let minimum = client_info
    .java_version
    .as_ref()
    .map_or(17, |java| java.major_version.max(17));
  client_info.java_version = Some(JavaVersion {
    component: String::new(),
    major_version: minimum,
  });
  Ok(())
}

pub fn validate_lwjgl3ify_java(major_version: i32, minimum: i32) -> SJMCLResult<()> {
  if !(minimum.max(17)..=26).contains(&major_version) {
    return Err(LaunchError::Lwjgl3ifyJavaIncompatible.into());
  }
  Ok(())
}

pub async fn prepare_lwjgl3ify(
  info: &Lwjgl3ifyLaunchInfo,
  libraries_dir: &Path,
) -> SJMCLResult<()> {
  let info = info.clone();
  let libraries_dir = libraries_dir.to_path_buf();
  tokio::task::spawn_blocking(move || prepare_patch(&info, &libraries_dir)).await?
}

fn prepare_patch(info: &Lwjgl3ifyLaunchInfo, libraries_dir: &Path) -> SJMCLResult<()> {
  if validate_sha1(info.mod_path.clone(), info.mod_sha1.clone()).is_err() {
    return Err(LaunchError::Lwjgl3ifyModChanged.into());
  }
  let dest = libraries_dir.join(&info.patch.path);
  if validate_sha1(dest.clone(), info.patch.sha1.clone()).is_ok() {
    return Ok(());
  }
  (|| -> SJMCLResult<()> {
    let mut jar = ZipArchive::new(BufReader::new(File::open(&info.mod_path)?))?;
    let data = read_entry(
      &mut jar,
      &format!("{RESOURCE_ROOT}forgePatches.zip"),
      32 * 1024 * 1024,
    )?;
    if format!("{:x}", Sha1::digest(&data)) != info.patch.sha1 {
      return Err(SJMCLError(
        "Bundled forgePatches checksum mismatch".to_string(),
      ));
    }
    let parent = dest.parent().ok_or(LaunchError::Lwjgl3ifyInvalidMetadata)?;
    fs::create_dir_all(parent)?;
    let temporary = parent.join(format!(".forgePatches-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| -> SJMCLResult<()> {
      let mut file = File::options()
        .write(true)
        .create_new(true)
        .open(&temporary)?;
      file.write_all(&data)?;
      file.sync_all()?;
      drop(file);
      fs::rename(&temporary, &dest)?;
      Ok(())
    })();
    if result.is_err() {
      let _ = fs::remove_file(&temporary);
    }
    result
  })()
  .map_err(|error| compatibility_error(LaunchError::Lwjgl3ifyPreparationFailed, error.0))
}

#[cfg(test)]
#[path = "lwjgl3ify_tests.rs"]
mod tests;
