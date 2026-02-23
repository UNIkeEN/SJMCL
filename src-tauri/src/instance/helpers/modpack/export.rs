use crate::error::SJMCLResult;
use crate::instance::helpers::modpack::modrinth::{
  ModrinthFile, ModrinthFileEnv, ModrinthFileHashes, ModrinthManifest,
};
use crate::instance::helpers::modpack::multimc::{MultiMcComponent, MultiMcManifest};
use crate::instance::models::misc::{Instance, InstanceError, ModLoaderType, ModpackFileList};
use crate::resource::helpers::{
  curseforge::fetch_remote_resource_by_local_curseforge,
  modrinth::fetch_remote_resource_by_local_modrinth,
};
use regex::{Regex, RegexSet};
use serde::{Deserialize, Serialize};
use sha1::Digest;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock};
use tauri::AppHandle;
use tokio::sync::Semaphore;
use walkdir::WalkDir;

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

fn normalize_mod_loader_version(raw: &str) -> String {
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

// ============================================================================
// Export Manifest Generators
// ============================================================================

/// Generate a Modrinth format manifest for the instance
pub fn generate_modrinth_manifest(
  instance: &Instance,
  options: &ExportModpackOptions,
) -> SJMCLResult<ModrinthManifest> {
  let mut dependencies = HashMap::new();

  // Add Minecraft version
  dependencies.insert("minecraft".to_string(), instance.version.clone());

  // Add mod loader if present
  if instance.mod_loader.loader_type != ModLoaderType::Unknown {
    let version = normalize_mod_loader_version(&instance.mod_loader.version);
    let loader_key = match instance.mod_loader.loader_type {
      ModLoaderType::Forge | ModLoaderType::LegacyForge => "forge",
      ModLoaderType::Fabric => "fabric-loader",
      ModLoaderType::NeoForge => "neoforge",
      ModLoaderType::Quilt => "quilt-loader",
      _ => "",
    };

    if !loader_key.is_empty() {
      dependencies.insert(loader_key.to_string(), version);
    }
  }

  Ok(ModrinthManifest {
    version_id: options.version.clone(),
    name: options.name.clone(),
    summary: options.description.clone(),
    files: Vec::new(),
    dependencies,
    ..Default::default()
  })
}

/// Generate a MultiMC format manifest for the instance
pub fn generate_multimc_manifest(
  instance: &Instance,
  _options: &ExportModpackOptions,
) -> SJMCLResult<MultiMcManifest> {
  let mut components = Vec::new();

  // Add Minecraft component (always important)
  components.push(MultiMcComponent {
    uid: "net.minecraft".to_string(),
    version: Some(instance.version.clone()),
    important: Some(true),
    dependency_only: Some(false),
    cached_name: None,
    cached_requires: None,
    cached_version: None,
    cached_volatile: None,
  });

  // Add mod loader component if present
  if instance.mod_loader.loader_type != ModLoaderType::Unknown {
    let version = normalize_mod_loader_version(&instance.mod_loader.version);
    let uid = match instance.mod_loader.loader_type {
      ModLoaderType::Forge | ModLoaderType::LegacyForge => "net.minecraftforge",
      ModLoaderType::NeoForge => "net.neoforged",
      ModLoaderType::Fabric => "net.fabricmc.fabric-loader",
      ModLoaderType::Quilt => "org.quiltmc.quilt-loader",
      _ => "",
    };

    if !uid.is_empty() {
      components.push(MultiMcComponent {
        uid: uid.to_string(),
        version: Some(version),
        important: Some(false),
        dependency_only: Some(false),
        cached_name: None,
        cached_requires: None,
        cached_version: None,
        cached_volatile: None,
      });
    }
  }

  Ok(MultiMcManifest {
    format_version: 1,
    components,
    cfg: HashMap::new(),
    base_path: String::new(),
  })
}

/// Generate instance.cfg file content for MultiMC
pub fn generate_multimc_instance_cfg(
  _instance: &Instance,
  options: &ExportModpackOptions,
) -> String {
  let mut content = format!(
    "# Auto generated by SJMC Launcher\nInstanceType=OneSix\nname={}\n",
    options.name
  );
  if let Some(min_memory) = options.min_memory {
    content.push_str("OverrideMemory=true\n");
    content.push_str(&format!("MinMemAlloc={}\n", min_memory));
  }
  content
}

// ============================================================================
// Remote File Collectors
// ============================================================================

async fn build_modrinth_remote_file(
  app: &AppHandle,
  rel: &str,
  full: &Path,
  skip_curseforge: bool,
) -> SJMCLResult<Option<ModrinthFile>> {
  // If disabled, mark it as optional in env
  let is_disabled = rel.ends_with(".disabled");
  let manifest_path = if is_disabled {
    rel.trim_end_matches(".disabled").to_string()
  } else {
    rel.to_string()
  };

  let mut downloads = Vec::new();

  if let Ok(remote) =
    fetch_remote_resource_by_local_modrinth(app, full.to_string_lossy().as_ref()).await
  {
    downloads.push(remote.download_url);
  }

  if !skip_curseforge {
    if let Ok(remote) =
      fetch_remote_resource_by_local_curseforge(app, full.to_string_lossy().as_ref()).await
    {
      downloads.push(remote.download_url);
    }
  }

  if downloads.is_empty() {
    return Ok(None);
  }

  let file_content = tokio::fs::read(full).await?;
  let mut sha1_hasher = sha1::Sha1::new();
  let mut sha512_hasher = sha2::Sha512::new();
  sha1_hasher.update(&file_content);
  sha512_hasher.update(&file_content);
  let sha1 = hex::encode(sha1_hasher.finalize());
  let sha512 = hex::encode(sha512_hasher.finalize());
  let file_size = file_content.len() as u64;
  let env = if is_disabled {
    Some(ModrinthFileEnv {
      client: "optional".to_string(),
      server: "unsupported".to_string(),
    })
  } else {
    None
  };

  Ok(Some(ModrinthFile {
    path: manifest_path,
    hashes: ModrinthFileHashes { sha1, sha512 },
    env,
    downloads,
    file_size,
  }))
}

pub async fn collect_modrinth_files(
  app: &AppHandle,
  selected_files: &[(String, PathBuf)],
  no_create_remote_files: bool,
  skip_curseforge: bool,
) -> SJMCLResult<(Vec<ModrinthFile>, Vec<(String, PathBuf)>)> {
  let is_remote_candidate = |rel: &str| {
    rel.starts_with("mods/") || rel.starts_with("resourcepacks/") || rel.starts_with("shaderpacks/")
  };

  let mut tasks = Vec::new();
  let semaphore = Arc::new(Semaphore::new(
    std::thread::available_parallelism().unwrap().into(),
  ));

  for (rel, full) in selected_files {
    let rel = rel.clone();
    let full = full.clone();
    let app = app.clone();
    let permit = semaphore
      .clone()
      .acquire_owned()
      .await
      .map_err(|_| InstanceError::SemaphoreAcquireFailed)?;

    let task = tokio::spawn(async move {
      let result = if is_remote_candidate(&rel) && !no_create_remote_files {
        build_modrinth_remote_file(&app, &rel, &full, skip_curseforge)
          .await
          .ok()
          .flatten()
      } else {
        None
      };

      drop(permit);
      (rel, full, result)
    });

    tasks.push(task);
  }

  let mut modrinth_files = Vec::new();
  let mut override_files = Vec::new();

  for task in tasks {
    if let Ok(res) = task.await {
      match res {
        (_, _, Some(modrinth_file)) => {
          modrinth_files.push(modrinth_file);
        }
        (rel, full, None) => {
          override_files.push((rel.to_string(), full));
        }
      }
    }
  }

  Ok((modrinth_files, override_files))
}
