use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use sjmcl_types::storage::load_json_async;
use std::collections::HashMap;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use tokio::sync::Semaphore;
use walkdir::WalkDir;
use zip::write::{ExtendedFileOptions, FileOptions};
use zip::{CompressionMethod, ZipWriter};

use crate::instance::helpers::client_json::McClientInfo;
use crate::instance::helpers::misc::{get_instance_game_config, get_instance_subdir_path_by_id};
use crate::instance::helpers::mods::common::{discover_local_mod_paths, get_mod_info_from_jar};
use crate::instance::models::misc::{Instance, InstanceError, InstanceSubdirType, ModLoaderType};
use crate::launch::helpers::jre_selector::select_java_runtime;
use crate::resource::helpers::modrinth::{
  fetch_modrinth_projects_environments, fetch_modrinth_version_files,
};

const SIDE_REQUIRED: &str = "required";
const SIDE_OPTIONAL: &str = "optional";
const SIDE_UNKNOWN: &str = "unknown";
const SIDE_UNSUPPORTED: &str = "unsupported";

// Official Modrinth environment values, ref:
// https://modrinth.com/news/article/new-environments/#new-system
const ENV_SERVER_REQUIRED: &[&str] = &[
  "server_only",
  "dedicated_server_only",
  "client_and_server",
  "server_only_client_optional",
];
const ENV_SERVER_OPTIONAL: &[&str] = &[
  "client_only_server_optional",
  "client_or_server_prefers_both",
  "client_or_server",
];
const ENV_SERVER_UNSUPPORTED: &[&str] = &["client_only", "singleplayer_only"];

const SERVER_FOLDER_DENYLIST: &[&str] = &[
  "mods",
  "saves",
  "server-resource-packs",
  "logs",
  "crash-reports",
  "resourcepacks",
  "shaderpacks",
  "screenshots",
  "schematics",
  "versions",
  "libraries",
  "assets",
];

const DEFAULT_SERVER_FOLDERS: &[&str] = &["config", "kubejs", "defaultconfigs"];

const EULA_TEXT: &str = "#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\neula=true\n";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerExportModInfo {
  pub path: String,
  pub name: String,
  pub mod_id: String,
  pub side: String,
  pub enabled: bool,
  pub uncertain: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerExportPlan {
  pub has_mod_loader: bool,
  pub supports_server_install: bool,
  pub mods: Vec<ServerExportModInfo>,
  pub saves: Vec<String>,
  pub server_resource_packs: Vec<String>,
  pub folders: Vec<String>,
  pub checked_folders: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerExportOptions {
  pub name: String,
  pub keep_save: Option<String>,
  pub accept_eula: bool,
  pub download_and_install: bool,
}

struct LocalModCandidate {
  path: String,
  name: String,
  mod_id: String,
  enabled: bool,
  sha1: String,
  local_side: String,
  local_uncertain: bool,
}

fn classify_fabric_environment(env: &str) -> Option<(String, bool)> {
  match env.trim().to_lowercase().as_str() {
    "server" => Some((SIDE_REQUIRED.to_string(), false)),
    "client" => Some((SIDE_UNSUPPORTED.to_string(), false)),
    "*" | "" => Some((SIDE_REQUIRED.to_string(), true)),
    _ => None,
  }
}

fn classify_modrinth_environment(envs: &[String]) -> String {
  let mut best_rank = 0u8;
  let mut best = SIDE_UNKNOWN.to_string();

  for env in envs {
    let lowered = env.to_lowercase();
    let (side, rank) = if ENV_SERVER_REQUIRED.contains(&lowered.as_str()) {
      (SIDE_REQUIRED, 3)
    } else if ENV_SERVER_OPTIONAL.contains(&lowered.as_str()) {
      (SIDE_OPTIONAL, 2)
    } else if ENV_SERVER_UNSUPPORTED.contains(&lowered.as_str()) {
      (SIDE_UNSUPPORTED, 1)
    } else {
      (SIDE_UNKNOWN, 0)
    };

    if rank > best_rank {
      best_rank = rank;
      best = side.to_string();
    }
  }

  best
}

fn detect_local_mod_side_from_bytes(bytes: &[u8]) -> Option<(String, bool)> {
  let cursor = io::Cursor::new(bytes);
  let mut jar = zip::ZipArchive::new(cursor).ok()?;

  for entry_name in ["fabric.mod.json", "quilt.mod.json"] {
    if let Ok(mut file) = jar.by_name(entry_name) {
      let mut content = String::new();
      if file.read_to_string(&mut content).is_ok()
        && let Ok(json) = serde_json::from_str::<serde_json::Value>(&content)
        && let Some(env) = json.get("environment").and_then(|value| value.as_str())
        && let Some(side) = classify_fabric_environment(env)
      {
        return Some(side);
      }
    }
  }

  None
}

fn side_priority(side: &str) -> u8 {
  match side {
    SIDE_UNKNOWN => 0,
    SIDE_REQUIRED => 1,
    SIDE_OPTIONAL => 2,
    _ => 3,
  }
}

fn sort_mods(mods: &mut [ServerExportModInfo]) {
  mods.sort_by(|a, b| {
    side_priority(&a.side)
      .cmp(&side_priority(&b.side))
      .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
  });
}

async fn build_local_mod_candidate(
  path: &Path,
  mods_dir: &Path,
  loader_type: ModLoaderType,
) -> LocalModCandidate {
  let rel = path
    .strip_prefix(mods_dir)
    .map(|rel| rel.to_string_lossy().replace('\\', "/"))
    .unwrap_or_else(|_| {
      path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default()
    });

  let file_name = path
    .file_name()
    .map(|name| name.to_string_lossy().to_string())
    .unwrap_or_default();
  let enabled = !file_name.to_ascii_lowercase().ends_with(".disabled");

  let stem = path
    .file_stem()
    .map(|stem| stem.to_string_lossy().to_string())
    .unwrap_or_else(|| file_name.clone());

  let path_buf = path.to_path_buf();
  let (name, mod_id) = match get_mod_info_from_jar(&path_buf, Some(loader_type)).await {
    Ok(info) => (
      if info.name.is_empty() {
        stem
      } else {
        info.name
      },
      info.mod_id,
    ),
    Err(_) => (stem, String::new()),
  };

  let bytes = tokio::fs::read(path).await.ok();
  let sha1 = bytes.as_deref().map_or_else(String::new, compute_sha1);
  let (local_side, local_uncertain) = bytes
    .as_deref()
    .and_then(detect_local_mod_side_from_bytes)
    .unwrap_or_else(|| (SIDE_UNKNOWN.to_string(), false));

  LocalModCandidate {
    path: format!("mods/{}", rel),
    name,
    mod_id,
    enabled,
    sha1,
    local_side,
    local_uncertain,
  }
}

async fn list_subdir_names(dir: &Path) -> Vec<String> {
  let mut names = Vec::new();
  if let Ok(mut entries) = tokio::fs::read_dir(dir).await {
    while let Ok(Some(entry)) = entries.next_entry().await {
      if let Ok(file_type) = entry.file_type().await
        && file_type.is_dir()
        && let Ok(name) = entry.file_name().into_string()
      {
        names.push(name);
      }
    }
  }
  names.sort_unstable();
  names
}

fn list_relative_files(dir: &Path) -> Vec<String> {
  let mut files = Vec::new();
  if !dir.exists() {
    return files;
  }

  for entry in WalkDir::new(dir).into_iter().filter_map(|entry| entry.ok()) {
    if entry.file_type().is_file()
      && let Ok(rel) = entry.path().strip_prefix(dir)
    {
      files.push(rel.to_string_lossy().replace('\\', "/"));
    }
  }

  files.sort_unstable();
  files
}

fn list_server_folders(root: &Path) -> (Vec<String>, Vec<String>) {
  let mut all = Vec::new();
  let mut checked = Vec::new();

  if !root.exists() {
    return (all, checked);
  }

  let Ok(entries) = std::fs::read_dir(root) else {
    return (all, checked);
  };

  for entry in entries.flatten() {
    if !entry.path().is_dir() {
      continue;
    }
    let Ok(name) = entry.file_name().into_string() else {
      continue;
    };
    if SERVER_FOLDER_DENYLIST.contains(&name.as_str()) {
      continue;
    }
    if DEFAULT_SERVER_FOLDERS.contains(&name.as_str()) {
      checked.push(name.clone());
    }
    all.push(name);
  }

  all.sort_unstable();
  checked.sort_unstable();
  (all, checked)
}

pub async fn analyze_server_export(
  app: &AppHandle,
  instance: &Instance,
) -> SJMCLResult<ServerExportPlan> {
  let has_mod_loader = instance.mod_loader.loader_type != ModLoaderType::Unknown;
  let supports_server_install = matches!(
    instance.mod_loader.loader_type,
    ModLoaderType::Unknown
      | ModLoaderType::Forge
      | ModLoaderType::NeoForge
      | ModLoaderType::Fabric
      | ModLoaderType::Quilt
  );
  let mut plan = ServerExportPlan {
    has_mod_loader,
    supports_server_install,
    mods: Vec::new(),
    saves: Vec::new(),
    server_resource_packs: Vec::new(),
    folders: Vec::new(),
    checked_folders: Vec::new(),
  };

  if let Some(dir) =
    get_instance_subdir_path_by_id(app, &instance.id, &InstanceSubdirType::ServerResourcePacks)
  {
    plan.server_resource_packs = list_relative_files(&dir);
  }

  if let Some(dir) = get_instance_subdir_path_by_id(app, &instance.id, &InstanceSubdirType::Saves) {
    plan.saves = list_subdir_names(&dir).await;
  }

  if let Some(root) = get_instance_subdir_path_by_id(app, &instance.id, &InstanceSubdirType::Root) {
    let (folders, checked_folders) = list_server_folders(&root);
    plan.folders = folders;
    plan.checked_folders = checked_folders;
  }

  if !has_mod_loader {
    return Ok(plan);
  }

  let mods_dir = get_instance_subdir_path_by_id(app, &instance.id, &InstanceSubdirType::Mods)
    .ok_or(InstanceError::FileNotFoundError)?;
  let paths = discover_local_mod_paths(&mods_dir, Some(instance.mod_loader.loader_type));

  let semaphore = Arc::new(Semaphore::new(
    std::thread::available_parallelism()
      .map(usize::from)
      .unwrap_or(4),
  ));
  let mut tasks = Vec::new();

  for path in paths {
    let permit = semaphore
      .clone()
      .acquire_owned()
      .await
      .map_err(|_| InstanceError::SemaphoreAcquireFailed)?;
    let mods_dir = mods_dir.clone();
    let loader_type = instance.mod_loader.loader_type;

    tasks.push(tokio::spawn(async move {
      let candidate = build_local_mod_candidate(&path, &mods_dir, loader_type).await;
      drop(permit);
      candidate
    }));
  }

  let mut candidates = Vec::new();
  for task in tasks {
    if let Ok(candidate) = task.await {
      candidates.push(candidate);
    }
  }

  // Identify mods via Modrinth batch APIs.
  let hashes: Vec<String> = candidates
    .iter()
    .filter(|candidate| !candidate.sha1.is_empty())
    .map(|candidate| candidate.sha1.clone())
    .collect();

  let version_files = if hashes.is_empty() {
    HashMap::new()
  } else {
    fetch_modrinth_version_files(app, &hashes)
      .await
      .unwrap_or_default()
  };

  let project_ids: Vec<String> = {
    let mut seen = std::collections::HashSet::new();
    for file in version_files.values() {
      if !file.project_id.is_empty() {
        seen.insert(file.project_id.clone());
      }
    }
    seen.into_iter().collect()
  };

  let project_envs = if project_ids.is_empty() {
    Vec::new()
  } else {
    fetch_modrinth_projects_environments(app, &project_ids)
      .await
      .unwrap_or_default()
  };

  let env_map: HashMap<String, Vec<String>> = project_envs
    .into_iter()
    .map(|project| (project.id, project.environment))
    .collect();

  let mut mods = Vec::new();
  for candidate in candidates {
    let mut side = SIDE_UNKNOWN.to_string();
    let mut uncertain = false;

    if let Some(file) = version_files.get(&candidate.sha1)
      && let Some(envs) = env_map.get(&file.project_id)
      && !envs.is_empty()
    {
      side = classify_modrinth_environment(envs);
      uncertain = false;
    }

    if side == SIDE_UNKNOWN {
      side = candidate.local_side;
      uncertain = candidate.local_uncertain;
    }

    mods.push(ServerExportModInfo {
      path: candidate.path,
      name: candidate.name,
      mod_id: candidate.mod_id,
      side,
      enabled: candidate.enabled,
      uncertain,
    });
  }

  sort_mods(&mut mods);
  plan.mods = mods;
  Ok(plan)
}

fn collect_dir_entries(
  entries: &mut Vec<(String, PathBuf)>,
  dir: &Path,
  prefix: &str,
) -> SJMCLResult<()> {
  if !dir.exists() {
    return Ok(());
  }

  for entry in WalkDir::new(dir) {
    let entry = entry?;
    if entry.file_type().is_file()
      && let Ok(rel) = entry.path().strip_prefix(dir)
    {
      let rel = rel.to_string_lossy().replace('\\', "/");
      let name = if prefix.is_empty() {
        rel
      } else {
        format!("{}/{}", prefix, rel)
      };
      entries.push((name, entry.into_path()));
    }
  }

  Ok(())
}

fn is_safe_dir_name(name: &str) -> bool {
  !name.is_empty() && name != "." && name != ".." && !name.contains('/') && !name.contains('\\')
}

fn should_store(path: &str) -> bool {
  let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
  matches!(
    ext.as_str(),
    "jar"
      | "zip"
      | "png"
      | "jpg"
      | "jpeg"
      | "gif"
      | "webp"
      | "gz"
      | "xz"
      | "ogg"
      | "mp3"
      | "mp4"
      | "nbt"
  )
}

fn write_server_zip(
  save_path: &str,
  entries: Vec<(String, PathBuf)>,
  extra_files: Vec<(String, String)>,
) -> SJMCLResult<()> {
  let output = std::fs::File::create(save_path)?;
  let output = io::BufWriter::with_capacity(1024 * 1024, output);
  let mut writer = ZipWriter::new(output);

  let deflate_options = FileOptions::<ExtendedFileOptions>::default()
    .compression_method(CompressionMethod::Deflated)
    .compression_level(Some(1));
  let store_options =
    FileOptions::<ExtendedFileOptions>::default().compression_method(CompressionMethod::Stored);

  for (name, content) in extra_files {
    writer.start_file(name, deflate_options.clone())?;
    writer.write_all(content.as_bytes())?;
  }

  for (name, full) in entries {
    let options = if should_store(&name) {
      store_options.clone()
    } else {
      deflate_options.clone()
    };
    writer.start_file(name, options)?;

    let file = std::fs::File::open(&full)?;
    let mut file = io::BufReader::with_capacity(1024 * 1024, file);
    io::copy(&mut file, &mut writer)?;
  }

  writer.finish()?;
  Ok(())
}

async fn resolve_server_java(app: &AppHandle, instance: &Instance) -> SJMCLResult<String> {
  let game_config = get_instance_game_config(app, instance);
  let client_json_req = load_json_async::<McClientInfo>(
    &instance
      .version_path
      .join(format!("{}.json", instance.name)),
  )
  .await
  .ok()
  .and_then(|info| info.java_version)
  .map_or(0, |version| version.major_version);

  let selected_java =
    select_java_runtime(app, Some(&game_config.game_java), instance, client_json_req).await?;

  Ok(selected_java.exec_path)
}

fn write_jar_start_scripts(dir: &Path, jar: &str) {
  let bat = format!(
    "@echo off\r\nREM SJMCL generated server start script.\r\njava -Xms1G -Xmx2G -jar {jar} nogui\r\npause\r\n"
  );
  let sh = format!(
    "#!/bin/sh\n# SJMCL generated server start script.\njava -Xms1G -Xmx2G -jar {jar} nogui\n"
  );
  let _ = std::fs::write(dir.join("start.bat"), bat);
  let _ = std::fs::write(dir.join("start.sh"), sh);
}

fn write_start_scripts(dir: &Path) {
  write_jar_start_scripts(dir, "server.jar");
}

fn compute_sha1(bytes: &[u8]) -> String {
  let mut hasher = Sha1::new();
  hasher.update(bytes);
  hex::encode(hasher.finalize())
}

fn verify_sha1(bytes: &[u8], expected: &str) -> SJMCLResult<()> {
  let expected = expected.trim();
  if expected.is_empty() {
    return Ok(());
  }

  if !compute_sha1(bytes).eq_ignore_ascii_case(expected) {
    return Err(SJMCLError("server file checksum mismatch".to_string()));
  }

  Ok(())
}

async fn download_vanilla_server_jar(app: &AppHandle, instance: &Instance) -> SJMCLResult<PathBuf> {
  let json_path = instance
    .version_path
    .join(format!("{}.json", instance.name));
  let client_info = load_json_async::<McClientInfo>(&json_path).await?;
  let download = client_info
    .downloads
    .get("server")
    .ok_or_else(|| SJMCLError("vanilla server download not found".to_string()))?;
  let url = download.url.clone();
  let expected_sha1 = download.sha1.clone();

  let client = app.state::<reqwest::Client>();
  let response = client.get(&url).send().await?;
  let bytes = response.bytes().await?;
  verify_sha1(&bytes, &expected_sha1)?;

  let dest = std::env::temp_dir().join(format!("sjmcl-server-{}.jar", uuid::Uuid::new_v4()));
  tokio::fs::write(&dest, &bytes).await?;
  Ok(dest)
}

fn build_forge_installer_url(instance: &Instance) -> SJMCLResult<String> {
  let loader = &instance.mod_loader;
  match loader.loader_type {
    ModLoaderType::NeoForge => {
      if loader.version.starts_with("1.20.1-") {
        Ok(format!(
          "https://maven.neoforged.net/releases/net/neoforged/forge/{v}/forge-{v}-installer.jar",
          v = loader.version
        ))
      } else {
        Ok(format!(
          "https://maven.neoforged.net/releases/net/neoforged/neoforge/{v}/neoforge-{v}-installer.jar",
          v = loader.version
        ))
      }
    }
    ModLoaderType::Forge => {
      let full = [
        instance.version.as_str(),
        loader.version.as_str(),
        loader.branch.as_deref().unwrap_or(""),
      ]
      .into_iter()
      .filter(|part| !part.is_empty())
      .collect::<Vec<_>>()
      .join("-");
      Ok(format!(
        "https://maven.minecraftforge.net/net/minecraftforge/forge/{full}/forge-{full}-installer.jar"
      ))
    }
    _ => Err(SJMCLError(
      "unsupported mod loader for server install".to_string(),
    )),
  }
}

async fn run_installer(
  app: &AppHandle,
  instance: &Instance,
  installer_url: &str,
  temp_dir: &Path,
  extra_args: &[String],
) -> SJMCLResult<()> {
  let installer_path = temp_dir.join("installer.jar");

  let client = app.state::<reqwest::Client>();
  let response = client.get(installer_url).send().await?;
  let bytes = response.bytes().await?;

  let expected_sha1 = client
    .get(format!("{}.sha1", installer_url))
    .send()
    .await?
    .text()
    .await?
    .trim()
    .to_string();
  if expected_sha1.is_empty() {
    return Err(SJMCLError("installer checksum unavailable".to_string()));
  }
  verify_sha1(&bytes, &expected_sha1)?;

  tokio::fs::write(&installer_path, &bytes).await?;

  let java = resolve_server_java(app, instance).await?;
  let installer_path_for_cmd = installer_path.clone();
  let temp_dir_for_cmd = temp_dir.to_path_buf();
  let extra_args_for_cmd = extra_args.to_vec();
  let status = tokio::task::spawn_blocking(move || {
    let mut command = std::process::Command::new(&java);
    command.arg("-jar").arg(&installer_path_for_cmd);
    command.args(&extra_args_for_cmd);
    command.current_dir(&temp_dir_for_cmd).status()
  })
  .await
  .map_err(|_| SJMCLError("server installer task failed".to_string()))??;

  if !status.success() {
    return Err(SJMCLError("server installer failed".to_string()));
  }

  let _ = tokio::fs::remove_file(&installer_path).await;
  let _ = tokio::fs::remove_file(temp_dir.join("installer.jar.log")).await;
  Ok(())
}

async fn install_forge_like_server(
  app: &AppHandle,
  instance: &Instance,
  temp_dir: &Path,
) -> SJMCLResult<()> {
  let installer_url = build_forge_installer_url(instance)?;
  let args = vec![
    "--installServer".to_string(),
    temp_dir.to_string_lossy().to_string(),
  ];
  run_installer(app, instance, &installer_url, temp_dir, &args).await
}

#[derive(Deserialize)]
struct InstallerVersion {
  version: String,
  #[serde(default)]
  stable: bool,
}

async fn fetch_fabric_installer_version(app: &AppHandle) -> Option<String> {
  let client = app.state::<reqwest::Client>();
  let versions: Vec<InstallerVersion> = client
    .get("https://meta.fabricmc.net/v2/versions/installer")
    .send()
    .await
    .ok()?
    .json()
    .await
    .ok()?;

  versions
    .iter()
    .find(|version| version.stable)
    .or_else(|| versions.first())
    .map(|version| version.version.clone())
}

async fn install_fabric_server(
  app: &AppHandle,
  instance: &Instance,
  temp_dir: &Path,
) -> SJMCLResult<()> {
  let installer_version = fetch_fabric_installer_version(app)
    .await
    .ok_or_else(|| SJMCLError("failed to resolve Fabric installer version".to_string()))?;
  let installer_url = format!(
    "https://maven.fabricmc.net/net/fabricmc/fabric-installer/{v}/fabric-installer-{v}.jar",
    v = installer_version
  );
  let args = vec![
    "server".to_string(),
    "-mcversion".to_string(),
    instance.version.clone(),
    "-loader".to_string(),
    instance.mod_loader.version.clone(),
    "-downloadMinecraft".to_string(),
  ];
  run_installer(app, instance, &installer_url, temp_dir, &args).await?;
  write_jar_start_scripts(temp_dir, "fabric-server-launch.jar");
  Ok(())
}

async fn fetch_quilt_installer_version(app: &AppHandle) -> Option<String> {
  let client = app.state::<reqwest::Client>();
  let versions: Vec<InstallerVersion> = client
    .get("https://meta.quiltmc.org/v3/versions/installer")
    .send()
    .await
    .ok()?
    .json()
    .await
    .ok()?;

  versions
    .iter()
    .find(|version| version.stable)
    .or_else(|| versions.first())
    .map(|version| version.version.clone())
}

async fn install_quilt_server(
  app: &AppHandle,
  instance: &Instance,
  temp_dir: &Path,
) -> SJMCLResult<()> {
  let installer_version = fetch_quilt_installer_version(app)
    .await
    .ok_or_else(|| SJMCLError("failed to resolve Quilt installer version".to_string()))?;
  let installer_url = format!(
    "https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/{v}/quilt-installer-{v}.jar",
    v = installer_version
  );
  let args = vec![
    "install".to_string(),
    "server".to_string(),
    instance.version.clone(),
    instance.mod_loader.version.clone(),
    "--download-server".to_string(),
    format!("--install-dir={}", temp_dir.to_string_lossy()),
  ];
  run_installer(app, instance, &installer_url, temp_dir, &args).await?;
  write_jar_start_scripts(temp_dir, "quilt-server-launch.jar");
  Ok(())
}

async fn prepare_server_runtime(
  app: &AppHandle,
  instance: &Instance,
) -> SJMCLResult<(Vec<(String, PathBuf)>, PathBuf)> {
  let temp_dir = std::env::temp_dir().join(format!("sjmcl-server-{}", uuid::Uuid::new_v4()));
  tokio::fs::create_dir_all(&temp_dir).await?;

  match instance.mod_loader.loader_type {
    ModLoaderType::Unknown => {
      let server_jar = download_vanilla_server_jar(app, instance).await?;
      tokio::fs::copy(&server_jar, temp_dir.join("server.jar")).await?;
      let _ = tokio::fs::remove_file(&server_jar).await;
      write_start_scripts(&temp_dir);
    }
    ModLoaderType::Forge | ModLoaderType::NeoForge => {
      install_forge_like_server(app, instance, &temp_dir).await?;
    }
    ModLoaderType::Fabric => {
      install_fabric_server(app, instance, &temp_dir).await?;
    }
    ModLoaderType::Quilt => {
      install_quilt_server(app, instance, &temp_dir).await?;
    }
    _ => {
      return Err(SJMCLError(
        "当前模组加载器暂不支持自动安装服务端".to_string(),
      ));
    }
  }

  let mut entries = Vec::new();
  collect_dir_entries(&mut entries, &temp_dir, "")?;
  Ok((entries, temp_dir))
}

pub async fn export_server_pack(
  app: &AppHandle,
  instance: &Instance,
  save_path: &str,
  options: &ServerExportOptions,
  selected_mods: &[String],
  selected_folders: &[String],
) -> SJMCLResult<()> {
  if options.name.trim().is_empty() {
    return Err(InstanceError::InvalidNameError.into());
  }

  let mut entries: Vec<(String, PathBuf)> = Vec::new();

  if let Some(mods_dir) =
    get_instance_subdir_path_by_id(app, &instance.id, &InstanceSubdirType::Mods)
  {
    for selected in selected_mods {
      let rel = selected.strip_prefix("mods/").unwrap_or(selected);
      let src = mods_dir.join(rel);
      if src.is_file() {
        entries.push((format!("mods/{}", rel), src));
      }
    }
  }

  if let Some(root) = get_instance_subdir_path_by_id(app, &instance.id, &InstanceSubdirType::Root) {
    for folder in selected_folders {
      if !is_safe_dir_name(folder) {
        continue;
      }
      let src = root.join(folder);
      if src.is_dir() {
        collect_dir_entries(&mut entries, &src, folder)?;
      }
    }
  }

  if let Some(dir) =
    get_instance_subdir_path_by_id(app, &instance.id, &InstanceSubdirType::ServerResourcePacks)
  {
    collect_dir_entries(&mut entries, &dir, "server-resource-packs")?;
  }

  if let Some(save_name) = &options.keep_save
    && let Some(saves_dir) =
      get_instance_subdir_path_by_id(app, &instance.id, &InstanceSubdirType::Saves)
  {
    let src = saves_dir.join(save_name);
    if src.is_dir() {
      // A dedicated server keeps the world at the root, and the generated
      // server.properties defaults to `level-name=world`.
      collect_dir_entries(&mut entries, &src, "world")?;
    }
  }

  let runtime_dir = if options.download_and_install {
    let (runtime_entries, dir) = prepare_server_runtime(app, instance).await?;
    entries.extend(runtime_entries);
    Some(dir)
  } else {
    None
  };

  let mut extra_files = Vec::new();
  if options.accept_eula {
    extra_files.push(("eula.txt".to_string(), EULA_TEXT.to_string()));
  }

  let save_path = save_path.to_string();

  tokio::task::spawn_blocking(move || write_server_zip(&save_path, entries, extra_files))
    .await
    .map_err(|_| InstanceError::ZipFileProcessFailed)??;

  if let Some(runtime_dir) = runtime_dir {
    let _ = tokio::fs::remove_dir_all(&runtime_dir).await;
  }
  Ok(())
}
