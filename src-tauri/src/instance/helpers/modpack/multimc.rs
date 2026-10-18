use async_trait::async_trait;
use config::Config;
use serde::{Deserialize, Serialize};
use sjmcl_types::error::SJMCLResult;
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use zip::ZipArchive;

use crate::instance::helpers::misc::get_instance_subdir_paths;
use crate::instance::helpers::modpack::export::{
  ExportModpackOptions, ModpackExportBundle, normalize_mod_loader_version,
};
use crate::instance::helpers::modpack::import::{
  ModpackManifest, ModpackMetaInfo, PreparedModpack, extract_overrides,
};
use crate::instance::helpers::modpack::multimc::patch::{
  assemble_client, read_local_patch, resolve_components,
};
use crate::instance::models::misc::{
  Instance, InstanceError, InstanceSubdirType, ModLoader, ModLoaderStatus, ModLoaderType,
};
use crate::launch::models::LaunchError;
use crate::launcher_config::helpers::java::build_mojang_java_download_params;
use crate::launcher_config::models::{GameConfig, JavaInfo, LauncherConfig};
use crate::resource::models::OtherResourceSource;
use crate::tasks::PTaskParam;

mod patch;
#[cfg(test)]
mod tests;

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MultiMcCacheRequires {
  pub uid: String,
  pub equals: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MultiMcComponent {
  pub cached_name: Option<String>,
  pub cached_requires: Option<Vec<MultiMcCacheRequires>>,
  pub cached_version: Option<String>,
  pub cached_volatile: Option<bool>,
  pub important: Option<bool>,
  pub dependency_only: Option<bool>,
  pub uid: String,
  pub version: Option<String>,
}

structstruck::strike! {
#[strikethrough[derive(Deserialize, Serialize, Debug, Clone)]]
#[strikethrough[serde(rename_all = "camelCase")]]
  pub struct MultiMcManifest {
    pub components: Vec<MultiMcComponent>,
    pub format_version: u64,
    #[serde(skip)]
    pub cfg: HashMap<String, String>,
    #[serde(skip)]
    pub base_path: String,
    #[serde(skip)]
    pub overrides_path: String,
  }
}

#[async_trait]
impl ModpackManifest for MultiMcManifest {
  fn from_archive(file: &File) -> SJMCLResult<Self> {
    let mut archive = ZipArchive::new(file)?;

    let base_path = if archive.by_name("mmc-pack.json").is_ok() {
      String::new()
    } else {
      let mut found_path = None;
      for i in 0..archive.len() {
        let file = archive.by_index(i)?;
        let name = file.name();

        if name.ends_with("mmc-pack.json")
          && let Some(last_slash) = name.rfind('/')
        {
          let dir_path = &name[..=last_slash];
          let depth = name[..last_slash].matches('/').count();
          if depth <= 1 {
            found_path = Some(dir_path.to_string());
            break;
          }
        }
      }
      found_path.ok_or(InstanceError::ModpackManifestParseError)?
    };

    let mut manifest: MultiMcManifest;
    {
      let manifest_path = format!("{}mmc-pack.json", base_path);
      let mut manifest_file = archive.by_name(&manifest_path)?;
      let mut manifest_content = String::new();
      manifest_file.read_to_string(&mut manifest_content)?;
      manifest = serde_json::from_str(&manifest_content)?;
    }

    if manifest.format_version != 1 {
      return Err(InstanceError::ModpackManifestParseError.into());
    }

    let cfg_path = format!("{}instance.cfg", base_path);
    let mut cfg_file = archive.by_name(&cfg_path)?;
    let mut cfg_str = String::new();
    cfg_file.read_to_string(&mut cfg_str)?;

    drop(cfg_file);

    let config = Config::builder()
      .add_source(config::File::from_str(&cfg_str, config::FileFormat::Ini))
      .build()?;

    manifest.overrides_path = format!("{base_path}.minecraft/");
    if archive
      .file_names()
      .any(|name| name.starts_with(&format!("{base_path}minecraft/")))
    {
      manifest.overrides_path = format!("{base_path}minecraft/");
    }
    for component in &mut manifest.components {
      if component.version.is_none()
        && component.cached_version.is_none()
        && let Some(patch) = read_local_patch(&mut archive, &base_path, &component.uid)?
      {
        component.version = Some(patch.version);
      }
    }
    manifest.base_path = base_path;
    manifest.cfg = config
      .try_deserialize::<HashMap<String, String>>()?
      .into_iter()
      .map(|(key, value)| (key.to_ascii_lowercase(), value))
      .collect();

    Ok(manifest)
  }

  async fn get_meta_info(&self, _app: &AppHandle) -> SJMCLResult<ModpackMetaInfo> {
    let client_version = self.get_client_version()?;
    let mod_loader = self
      .get_mod_loader_type_version()
      .ok()
      .map(|(loader_type, version)| ModLoader {
        loader_type,
        version,
        ..Default::default()
      });
    Ok(ModpackMetaInfo {
      name: self.cfg.get("name").cloned().unwrap_or_default(),
      version: None,
      description: None,
      author: None,
      modpack_source: OtherResourceSource::MultiMc,
      client_version,
      mod_loader,
    })
  }

  fn get_client_version(&self) -> SJMCLResult<String> {
    let component = self
      .components
      .iter()
      .find(|component| component.uid == "net.minecraft")
      .ok_or(InstanceError::ModpackManifestParseError)?;

    get_version(component)
  }

  fn get_mod_loader_type_version(&self) -> SJMCLResult<(ModLoaderType, String)> {
    for component in &self.components {
      match component.uid.as_str() {
        "net.minecraft" => continue,
        "net.minecraftforge" => return Ok((ModLoaderType::Forge, get_version(component)?)),
        "net.fabricmc.fabric-loader" => {
          return Ok((ModLoaderType::Fabric, get_version(component)?));
        }
        "org.quiltmc.quilt-loader" => return Ok((ModLoaderType::Quilt, get_version(component)?)),
        "com.cleanroommc.cleanroom" => {
          return Ok((ModLoaderType::Cleanroom, get_version(component)?));
        }
        "com.mumfrey.liteloader" => {
          return Ok((ModLoaderType::LiteLoader, get_version(component)?));
        }
        "net.neoforged" => return Ok((ModLoaderType::NeoForge, get_version(component)?)),
        _ => continue,
      }
    }
    Err(InstanceError::ModpackManifestParseError.into())
  }

  async fn get_download_params(
    &self,
    _app: &AppHandle,
    _instance_path: &Path,
  ) -> SJMCLResult<Vec<PTaskParam>> {
    Ok(Vec::new())
  }

  fn get_overrides_path(&self) -> String {
    self.overrides_path.clone()
  }

  async fn prepare_instance(
    &self,
    app: &AppHandle,
    file: &File,
    instance: &mut Instance,
  ) -> SJMCLResult<Option<PreparedModpack>> {
    let mut game_config = app
      .state::<Mutex<LauncherConfig>>()
      .lock()?
      .global_game_config
      .clone();
    apply_instance_config(&self.cfg, &mut game_config)?;
    instance.spec_game_config = Some(game_config);
    instance.use_spec_game_config = true;
    instance.mod_loader.status = ModLoaderStatus::Installed;
    let directories = get_instance_subdir_paths(app, instance, &[&InstanceSubdirType::Libraries])
      .ok_or(InstanceError::InstanceNotFoundByID)?;
    let client = app.state::<reqwest::Client>();
    let patches = resolve_components(self, file, &client).await?;
    let (client_info, compatible_java_majors) = assemble_client(
      patches,
      file,
      &self.base_path,
      &directories[0],
      &instance.version_path,
      &instance.name,
    )?;
    extract_overrides(
      file,
      &instance.version_path.join("libraries"),
      &format!("{}libraries/", self.base_path),
    )?;
    let (download_params, java_version) = configure_java(
      app,
      instance.spec_game_config.as_mut().unwrap(),
      &compatible_java_majors,
    )
    .await?;
    Ok(Some(PreparedModpack {
      client_info,
      download_params,
      java_version,
    }))
  }
}

fn select_compatible_java<'a>(javas: &'a [JavaInfo], compatible: &[i32]) -> Option<&'a JavaInfo> {
  javas
    .iter()
    .filter(|java| compatible.contains(&java.major_version))
    .min_by_key(|java| java.major_version)
}

fn downloadable_java_major(compatible: &[i32]) -> Option<i32> {
  compatible
    .iter()
    .copied()
    .filter(|version| [8, 16, 17, 21, 25].contains(version))
    .max()
}

async fn configure_java(
  app: &AppHandle,
  config: &mut GameConfig,
  compatible: &[i32],
) -> SJMCLResult<(Vec<PTaskParam>, Option<String>)> {
  if compatible.is_empty() {
    return Ok((Vec::new(), None));
  }
  let selected =
    select_compatible_java(&app.state::<Mutex<Vec<JavaInfo>>>().lock()?, compatible).cloned();
  let (path, params, version) = if let Some(java) = selected {
    (java.exec_path, Vec::new(), None)
  } else {
    let auto_download = app
      .state::<Mutex<LauncherConfig>>()
      .lock()?
      .general
      .functionality
      .auto_download_java;
    if !auto_download {
      return Err(LaunchError::NoSuitableJava.into());
    }
    let version = downloadable_java_major(compatible)
      .ok_or(LaunchError::NoSuitableJava)?
      .to_string();
    let params = build_mojang_java_download_params(app, &version).await?;
    let java_name = if cfg!(target_os = "windows") {
      "java.exe"
    } else {
      "java"
    };
    let path = params
      .iter()
      .find_map(|param| {
        let PTaskParam::Download(param) = param;
        (param.dest.file_name().is_some_and(|name| name == java_name))
          .then(|| param.dest.to_string_lossy().into_owned())
      })
      .ok_or(LaunchError::NoSuitableJava)?;
    (path, params, Some(version))
  };
  config.game_java.auto = false;
  config.game_java.exec_path = path;
  Ok((params, version))
}

fn apply_instance_config(
  cfg: &HashMap<String, String>,
  game_config: &mut GameConfig,
) -> SJMCLResult<()> {
  let enabled = |key: &str| {
    cfg
      .get(key)
      .is_some_and(|value| value.eq_ignore_ascii_case("true"))
  };
  game_config.version_isolation = true;
  if enabled("overridejavaargs") {
    game_config.advanced_options.enabled = true;
    game_config.advanced.jvm.args = cfg.get("jvmargs").cloned().unwrap_or_default();
  }
  if enabled("overridememory") {
    if let Some(max) = cfg.get("maxmemalloc") {
      game_config.performance.max_mem_allocation = max.parse()?;
      game_config.performance.auto_mem_allocation = false;
    }
    if let Some(min) = cfg.get("minmemalloc") {
      let min: u32 = min.parse()?;
      game_config
        .advanced
        .jvm
        .args
        .push_str(&format!(" -Xms{min}m"));
      game_config.advanced_options.enabled = true;
    }
    if let Some(permgen) = cfg.get("permgen") {
      game_config.advanced.jvm.java_permanent_generation_space = permgen.parse()?;
    }
  }
  Ok(())
}

fn get_version(component: &MultiMcComponent) -> SJMCLResult<String> {
  component
    .version
    .as_ref()
    .or(component.cached_version.as_ref())
    .cloned()
    .ok_or(InstanceError::ModpackManifestParseError.into())
}

pub fn build_multimc_export_bundle(
  instance: &Instance,
  options: &ExportModpackOptions,
  selected_files: &[(String, PathBuf)],
) -> SJMCLResult<ModpackExportBundle> {
  let manifest = generate_multimc_manifest(instance);
  let json = serde_json::to_string_pretty(&manifest)
    .map_err(|_| InstanceError::ModpackManifestParseError)?;

  Ok(ModpackExportBundle {
    overrides_prefix: ".minecraft".to_string(),
    overrides_files: selected_files.to_vec(),
    extra_files: vec![
      ("mmc-pack.json".to_string(), json),
      (
        "instance.cfg".to_string(),
        generate_multimc_instance_cfg(options),
      ),
      (".packignore".to_string(), String::new()),
    ],
  })
}

fn generate_multimc_manifest(instance: &Instance) -> MultiMcManifest {
  let mut components = Vec::new();
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

  MultiMcManifest {
    format_version: 1,
    components,
    cfg: HashMap::new(),
    base_path: String::new(),
    overrides_path: String::new(),
  }
}

fn generate_multimc_instance_cfg(options: &ExportModpackOptions) -> String {
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
