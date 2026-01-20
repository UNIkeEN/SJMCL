use crate::error::SJMCLResult;
use crate::instance::models::misc::Instance;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum ExportFormat {
  Modrinth,
  MCBBS,
  MultiMC,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportModpackOptions {
  pub format: ExportFormat,
  pub name: String,
  pub version: String,
  pub author: Option<String>,
  pub description: Option<String>,
  pub include_config: bool,
  pub include_mods: bool,
  pub include_resourcepacks: bool,
  pub include_shaderpacks: bool,
  pub include_saves: bool,
}

/// Blacklist patterns for files that should never be exported
fn get_blacklist_patterns() -> Vec<String> {
  vec![
    // Logs
    r".*\.log$".to_string(),
    // Backups
    r".*\.dat_old$".to_string(),
    r".*\.old$".to_string(),
    r".*\.BakaCoreInfo$".to_string(),
    // Native libraries
    r".*-natives.*".to_string(),
    // Caches
    "usernamecache.json".to_string(),
    "usercache.json".to_string(),
    // Launcher files
    "launcher_profiles.json".to_string(),
    "launcher.pack.lzma".to_string(),
    "launcher_accounts.json".to_string(),
    "launcher_cef_log.txt".to_string(),
    "launcher_log.txt".to_string(),
    "launcher_msa_credentials.bin".to_string(),
    "launcher_settings.json".to_string(),
    "launcher_ui_state.json".to_string(),
    "realms_persistence.json".to_string(),
    "webcache2".to_string(),
    "treatment_tags.json".to_string(),
    // PCL
    "clientId.txt".to_string(),
    "PCL.ini".to_string(),
    // HMCL
    "backup".to_string(),
    "pack.json".to_string(),
    "launcher.jar".to_string(),
    "cache".to_string(),
    "modpack.cfg".to_string(),
    "log4j2.xml".to_string(),
    "hmclversion.cfg".to_string(),
    // Modpack manifests
    "manifest.json".to_string(),
    "minecraftinstance.json".to_string(),
    ".curseclient".to_string(),
    "modrinth.index.json".to_string(),
    // Mod temporary files
    ".fabric".to_string(),
    ".mixin.out".to_string(),
    ".optifine".to_string(),
    // Minecraft directories
    "jars".to_string(),
    "logs".to_string(),
    "versions".to_string(),
    "assets".to_string(),
    "libraries".to_string(),
    "crash-reports".to_string(),
    "NVIDIA".to_string(),
    "AMD".to_string(),
    "screenshots".to_string(),
    "natives".to_string(),
    "native".to_string(),
    "$native".to_string(),
    "$natives".to_string(),
    "server-resource-packs".to_string(),
    "command_history.txt".to_string(),
    // Other
    "downloads".to_string(),
    "essential".to_string(),
    "asm".to_string(),
    "backups".to_string(),
    "TCNodeTracker".to_string(),
    "CustomDISkins".to_string(),
    "data".to_string(),
    "debug".to_string(),
    ".replay_cache".to_string(),
    "replay_recordings".to_string(),
    "replay_videos".to_string(),
    "irisUpdateInfo.json".to_string(),
    "modernfix".to_string(),
    "modtranslations".to_string(),
    "schematics".to_string(),
    "mods/.connector".to_string(),
    // Cache directories
    "CustomSkinLoader/caches".to_string(),
    "journeymap/data".to_string(),
  ]
}

/// Optional files that user can choose to exclude
fn get_optional_excludes() -> Vec<String> {
  vec![
    "fonts".to_string(),              // BetterFonts
    "saves".to_string(),              // World saves
    "servers.dat".to_string(),        // Server list
    "options.txt".to_string(),        // Game settings
    "blueprints".to_string(),         // BuildCraft
    "optionsof.txt".to_string(),      // OptiFine settings
    "journeymap".to_string(),         // JourneyMap
    "optionsshaders.txt".to_string(), // Shader settings
    "mods/VoxelMods".to_string(),
  ]
}

/// Check if a file should be included based on blacklist and user options
pub fn should_include_file(
  path: &Path,
  instance_path: &Path,
  options: &ExportModpackOptions,
) -> bool {
  let relative_path = match path.strip_prefix(instance_path) {
    Ok(p) => p,
    Err(_) => return false,
  };

  let path_str = relative_path.to_string_lossy().replace("\\", "/");

  let blacklist = get_blacklist_patterns();
  for pattern in &blacklist {
    if pattern.starts_with("regex:") || pattern.contains(".*") {
      if let Ok(re) = Regex::new(pattern) {
        if re.is_match(&path_str) {
          return false;
        }
      }
    } else if path_str == *pattern || path_str.starts_with(&format!("{}/", pattern)) {
      return false;
    }
  }

  if !options.include_config && (path_str.starts_with("config/") || path_str == "config") {
    return false;
  }

  if !options.include_mods && (path_str.starts_with("mods/") || path_str == "mods") {
    return false;
  }

  if !options.include_resourcepacks
    && (path_str.starts_with("resourcepacks/") || path_str == "resourcepacks")
  {
    return false;
  }

  if !options.include_shaderpacks
    && (path_str.starts_with("shaderpacks/") || path_str == "shaderpacks")
  {
    return false;
  }

  if !options.include_saves && (path_str.starts_with("saves/") || path_str == "saves") {
    return false;
  }

  // Exclude version-specific files
  let instance_name = instance_path
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("");
  if path_str == format!("{}.json", instance_name) || path_str == format!("{}.jar", instance_name) {
    return false;
  }

  true
}

/// Collect all files to be exported from the instance
pub fn collect_export_files(
  instance: &Instance,
  options: &ExportModpackOptions,
) -> SJMCLResult<Vec<PathBuf>> {
  let mut files = Vec::new();
  let instance_path = &instance.version_path;

  if !instance_path.exists() {
    return Err(crate::instance::models::misc::InstanceError::FileNotFoundError.into());
  }

  // Recursively walk the directory
  fn walk_dir(
    dir: &Path,
    instance_path: &Path,
    options: &ExportModpackOptions,
    files: &mut Vec<PathBuf>,
  ) -> SJMCLResult<()> {
    if !dir.is_dir() {
      return Ok(());
    }

    for entry in fs::read_dir(dir)? {
      let entry = entry?;
      let path = entry.path();

      if path.is_dir() {
        walk_dir(&path, instance_path, options, files)?;
      } else if path.is_file() && should_include_file(&path, instance_path, options) {
        files.push(path);
      }
    }

    Ok(())
  }

  walk_dir(instance_path, instance_path, options, &mut files)?;

  Ok(files)
}

/// Validate export options before proceeding
pub fn validate_export_options(
  instance: &Instance,
  options: &ExportModpackOptions,
) -> SJMCLResult<()> {
  // Check required fields
  if options.name.trim().is_empty() {
    return Err(crate::instance::models::misc::InstanceError::InvalidNameError.into());
  }

  if options.version.trim().is_empty() {
    return Err(crate::instance::models::misc::InstanceError::ModpackManifestParseError.into());
  }

  if !instance.version_path.exists() {
    return Err(crate::instance::models::misc::InstanceError::FileNotFoundError.into());
  }

  if !options.include_config
    && !options.include_mods
    && !options.include_resourcepacks
    && !options.include_shaderpacks
    && !options.include_saves
  {
    return Err(crate::instance::models::misc::InstanceError::ModpackManifestParseError.into());
  }

  Ok(())
}
