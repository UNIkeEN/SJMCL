use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::helpers::modpack::{
  modrinth::build_modrinth_export_bundle, multimc::build_multimc_export_bundle,
};
use crate::instance::models::misc::{Instance, InstanceError, ModpackFileList};
use regex::{Regex, RegexSet};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io::{self, Write};
use std::path::PathBuf;
use std::sync::LazyLock;
use tauri::AppHandle;
use walkdir::WalkDir;
use zip::write::{ExtendedFileOptions, FileOptions};
use zip::{CompressionMethod, ZipWriter};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum ExportFormat {
  Modrinth,
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
  pub pack_with_launcher: Option<bool>, // TODO: unused currently
  pub min_memory: Option<u32>,          // for MultiMC
  pub no_create_remote_files: Option<bool>, // for Modrinth
  pub skip_curseforge_remote_files: Option<bool>, // for Modrinth
}

/// Validate export options before proceeding
pub fn validate_export_options(
  instance: &Instance,
  options: &ExportModpackOptions,
) -> SJMCLResult<()> {
  // Check required fields
  if options.name.trim().is_empty() {
    return Err(InstanceError::InvalidNameError.into());
  }

  if options.version.trim().is_empty() {
    return Err(InstanceError::ModpackManifestParseError.into());
  }

  if !instance.version_path.exists() {
    return Err(InstanceError::FileNotFoundError.into());
  }

  Ok(())
}

// ============================================================================
// Candidate File Listing
// ============================================================================

static REGEX_BLACKLIST: LazyLock<RegexSet> = LazyLock::new(|| {
  RegexSet::new([
    r".*\.log$",
    r".*-natives$",
    r"natives-.*$",
    r"^\._.*",
    // Backup files
    r".*\.dat_old$",
    r".*\.old$",
    // BakaXL
    r".*\.BakaCoreInfo$",
  ])
  .expect("Invalid regex patterns")
});

static BLACKLIST: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  HashSet::from([
    ".DS_Store",
    "desktop.ini",
    "Thumbs.db",
    // Minecraft
    "usernamecache.json",
    "usercache.json",
    "jars",
    "logs",
    "versions",
    "assets",
    "libraries",
    "crash-reports",
    "NVIDIA",
    "AMD",
    "screenshots",
    "natives",
    "native",
    "$native",
    "$natives",
    "server-resource-packs",
    "command_history.txt",
    // Old Minecraft Launcher
    "launcher_profiles.json",
    "launcher.pack.lzma",
    // New Minecraft Launcher
    "launcher_accounts.json",
    "launcher_cef_log.txt",
    "launcher_log.txt",
    "launcher_msa_credentials.bin",
    "launcher_settings.json",
    "launcher_ui_state.json",
    "realms_persistence.json",
    "webcache2",
    "treatment_tags.json",
    // Plain Craft Launcher
    "clientId.txt",
    "PCL.ini",
    // HMCL
    "backup",
    "pack.json",
    "launcher.jar",
    "cache",
    "modpack.cfg",
    "log4j2.xml",
    "hmclversion.cfg",
    // SJMCL
    "install_profile.json",
    "sjmclcfg.json",
    // Curse
    "manifest.json",
    "minecraftinstance.json",
    ".curseclient",
    // Modrinth
    "modrinth.index.json",
    // Fabric/OptiFine
    ".fabric",
    ".mixin.out",
    ".optifine",
    // Downloads and Essential
    "downloads",
    "essential",
    // Mods
    "asm",
    "backups",
    "TCNodeTracker",
    "CustomDISkins",
    "data",
    "CustomSkinLoader/caches",
    // Debug files
    "debug",
    // ReplayMod
    ".replay_cache",
    "replay_recordings",
    "replay_videos",
    // Iris
    "irisUpdateInfo.json",
    // ModernFix
    "modernfix",
    // Mod translations
    "modtranslations",
    // Schematics mod
    "schematics",
    // JourneyMap
    "journeymap/data",
    // Sinytra Connector
    "mods/.connector",
  ])
});

// ugly, consider GlobSet if this grows too large
static SUGGESTED_BLACKLIST: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  HashSet::from([
    // BetterFonts
    "fonts",
    // Minecraft
    "saves",
    "servers.dat",
    "options.txt",
    // BuildCraft
    "blueprints",
    // OptiFine
    "optionsof.txt",
    // JourneyMap
    "journeymap",
    "optionsshaders.txt",
    // VoxelMods
    "mods/VoxelMods",
  ])
});

static SUGGESTED_REGEX_BLACKLIST: LazyLock<RegexSet> = LazyLock::new(|| {
  RegexSet::new([
    r"^fonts/.*$",
    r"^saves/.*$",
    r"^blueprints/.*$",
    r"^journeymap/.*$",
    r"^mods/VoxelMods/.*$",
  ])
  .expect("Invalid regex")
});

/// List all files that can be offered to the user in the modpack export tree UI.
pub fn list_files(instance: &Instance) -> SJMCLResult<ModpackFileList> {
  let root = &instance.version_path;
  if !root.exists() {
    return Err(InstanceError::FileNotFoundError.into());
  }

  let name = &instance.name;
  let mut files = Vec::new();
  let mut unchecked_files = Vec::new();

  let walker = WalkDir::new(root).into_iter();
  let iter = walker.filter_entry(|entry| {
    let path = entry.path();

    let rel_path = match path.strip_prefix(root) {
      Ok(rel) => rel,
      Err(_) => return false,
    };
    let rel_str = rel_path.to_string_lossy().replace('\\', "/");

    if BLACKLIST.contains(rel_str.as_str()) {
      return false;
    }
    if REGEX_BLACKLIST.is_match(rel_str.as_str()) {
      return false;
    }
    true
  });

  for entry in iter {
    let entry = match entry {
      Ok(e) => e,
      Err(_) => continue,
    };

    if entry.file_type().is_file() {
      let path = entry.path();
      // Ignore name.jar / name.json
      if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
        if stem == name {
          continue;
        }
      }

      if let Ok(rel_path) = path.strip_prefix(root) {
        let rel_str = rel_path.to_string_lossy().replace('\\', "/");

        if SUGGESTED_BLACKLIST.contains(rel_str.as_str())
          || SUGGESTED_REGEX_BLACKLIST.is_match(&rel_str)
        {
          unchecked_files.push(rel_str.clone());
        }

        files.push(rel_str);
      }
    }
  }

  files.sort_unstable();
  unchecked_files.sort_unstable();
  Ok(ModpackFileList {
    all: files,
    unchecked: unchecked_files,
  })
}

static FORGE_VERSION_REGEX: LazyLock<Regex> = LazyLock::new(|| {
  // Forge: "1.16.5-forge-36.2.39" (Including NeoForge 1.20.1)
  Regex::new(r"([\d.]+)-forge-([\d.]+)").expect("Invalid regex")
});

static NEOFORGE_VERSION_REGEX: LazyLock<Regex> = LazyLock::new(|| {
  // NeoForge: "neoforge-21.4.121" (Not processed for "21.10.0-beta" or "0.25w14craftmine.3-beta")
  Regex::new(r"(neoforge-)?([a-zA-Z0-9.-]+)(-beta)?").expect("Invalid regex")
});

pub(crate) fn normalize_mod_loader_version(raw: &str) -> String {
  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return raw.to_string();
  }

  if let Some(caps) = FORGE_VERSION_REGEX.captures(trimmed) {
    if let Some(matched) = caps.get(2) {
      return matched.as_str().to_string();
    }
  }

  if let Some(caps) = NEOFORGE_VERSION_REGEX.captures(trimmed) {
    if let Some(matched) = caps.get(2) {
      return matched.as_str().to_string();
    }
  }

  raw.to_string()
}

#[derive(Debug, Clone)]
pub struct ModpackExportBundle {
  pub overrides_prefix: String,
  pub overrides_files: Vec<(String, PathBuf)>,
  pub extra_files: Vec<(String, String)>,
}

pub async fn build_export_bundle(
  app: &AppHandle,
  instance: &Instance,
  options: &ExportModpackOptions,
  selected_files: &[(String, PathBuf)],
) -> SJMCLResult<ModpackExportBundle> {
  match options.format {
    ExportFormat::Modrinth => {
      build_modrinth_export_bundle(app, instance, options, selected_files).await
    }
    ExportFormat::MultiMC => build_multimc_export_bundle(instance, options, selected_files),
  }
}

fn should_store(path: &str) -> bool {
  // For these types of files, compression often doesn't reduce size.
  let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
  matches!(
    ext.as_str(),
    "jar"
      | "png"
      | "jpg"
      | "jpeg"
      | "gif"
      | "webp"
      | "zip"
      | "gz"
      | "xz"
      | "ogg"
      | "mp3"
      | "mp4"
      | "nbt"
  )
}

pub async fn create_modpack_zip(
  save_path: &str,
  export_bundle: ModpackExportBundle,
) -> SJMCLResult<()> {
  let save_path = save_path.to_string();
  let ModpackExportBundle {
    overrides_prefix,
    overrides_files,
    extra_files,
  } = export_bundle;

  tokio::task::spawn_blocking(move || -> SJMCLResult<()> {
    let output = std::fs::File::create(&save_path)
      .map_err(|e| SJMCLError(format!("Failed to create zip file: {}", e)))?;
    let output = io::BufWriter::with_capacity(1024 * 1024, output);
    let mut writer = ZipWriter::new(output);
    let deflate_options = FileOptions::<ExtendedFileOptions>::default()
      .compression_method(CompressionMethod::Deflated)
      .compression_level(Some(1));
    let store_options =
      FileOptions::<ExtendedFileOptions>::default().compression_method(CompressionMethod::Stored);

    for (name, content) in extra_files {
      writer
        .start_file(name, deflate_options.clone())
        .map_err(|e| SJMCLError(format!("Failed to create zip entry: {}", e)))?;
      writer
        .write_all(content.as_bytes())
        .map_err(|e| SJMCLError(format!("Failed to write extra file to zip: {}", e)))?;
    }

    for (rel, full) in overrides_files {
      let entry_path = format!("{}/{}", overrides_prefix, rel);
      let options = if should_store(&entry_path) {
        store_options.clone()
      } else {
        deflate_options.clone()
      };
      writer
        .start_file(entry_path, options)
        .map_err(|e| SJMCLError(format!("Failed to create zip entry: {}", e)))?;

      let file = std::fs::File::open(&full)
        .map_err(|e| SJMCLError(format!("Failed to open file {}: {}", full.display(), e)))?;
      let mut file = io::BufReader::with_capacity(1024 * 1024, file);

      io::copy(&mut file, &mut writer).map_err(|e| {
        SJMCLError(format!(
          "Failed to copy file {} to zip: {}",
          full.display(),
          e
        ))
      })?;
    }

    writer
      .finish()
      .map_err(|e| SJMCLError(format!("Failed to finalize zip file: {}", e)))?;

    Ok(())
  })
  .await
  .map_err(|e| SJMCLError(format!("Failed to join zip creation task: {}", e)))?
}
