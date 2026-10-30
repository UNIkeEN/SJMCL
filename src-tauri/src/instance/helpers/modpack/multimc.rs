use async_trait::async_trait;
use config::Config;
use serde::{Deserialize, Serialize};
use sjmcl_types::error::SJMCLResult;
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use zip::ZipArchive;

use crate::download::DownloadTask;
use crate::instance::helpers::modpack::export::{
  ExportModpackOptions, ModpackExportBundle, normalize_mod_loader_version,
};
use crate::instance::helpers::modpack::import::{ModpackManifest, ModpackMetaInfo};
use crate::instance::models::misc::{Instance, InstanceError, ModLoader, ModLoaderType};
use crate::resource::models::OtherResourceSource;

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
    pub game_dir: String,
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
        let name = file.name()?;

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

    // MultiMC (and SJMCL's export) stores the game directory as `.minecraft`, while
    // Prism Launcher uses `minecraft`. Prefer the former and fall back to the latter.
    let has_dir = |dir: &str| {
      let prefix = format!("{}{}/", base_path, dir);
      archive
        .file_names()
        .any(|name| name.is_ok_and(|name| name.starts_with(&prefix)))
    };
    let game_dir = if !has_dir(".minecraft") && has_dir("minecraft") {
      "minecraft"
    } else {
      ".minecraft"
    };

    let mut manifest: MultiMcManifest;
    {
      let manifest_path = format!("{}mmc-pack.json", base_path);
      let mut manifest_file = archive.by_name(&manifest_path)?;
      let mut manifest_content = String::new();
      manifest_file.read_to_string(&mut manifest_content)?;
      manifest = serde_json::from_str(&manifest_content)?;
    }

    let cfg_path = format!("{}instance.cfg", base_path);
    let mut cfg_file = archive.by_name(&cfg_path)?;
    let mut cfg_str = String::new();
    cfg_file.read_to_string(&mut cfg_str)?;

    let config = Config::builder()
      .add_source(config::File::from_str(&cfg_str, config::FileFormat::Ini))
      .build()?;

    manifest.base_path = base_path;
    manifest.game_dir = game_dir.to_string();
    manifest.cfg = config.try_deserialize::<HashMap<String, String>>()?;

    Ok(manifest)
  }

  async fn get_meta_info(&self, app: &AppHandle) -> SJMCLResult<ModpackMetaInfo> {
    let client_version = self.get_client_version()?;
    let mod_loader = if let Ok((loader_type, version)) = self.get_mod_loader_type_version() {
      Some(
        ModLoader {
          loader_type,
          version,
          ..Default::default()
        }
        .with_branch(app, client_version.clone())
        .await?,
      )
    } else {
      None
    };
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
  ) -> SJMCLResult<Vec<DownloadTask>> {
    // MultiMC Manifests do not include download parameters
    Ok(Vec::new())
  }

  fn get_overrides_path(&self) -> String {
    format!("{}{}/", self.base_path, self.game_dir)
  }
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
    game_dir: ".minecraft".to_string(),
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

#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;
  use std::io::Write;
  use zip::ZipWriter;
  use zip::write::SimpleFileOptions;

  use crate::instance::helpers::modpack::import::extract_overrides;

  const MMC_PACK: &str =
    r#"{"formatVersion":1,"components":[{"uid":"net.minecraft","version":"1.20.1"}]}"#;

  fn import_overrides(test_name: &str, entries: &[(&str, &str)]) -> PathBuf {
    let test_root = std::env::temp_dir().join(format!(
      "sjmcl-multimc-test-{}-{}",
      std::process::id(),
      test_name
    ));
    let _ = fs::remove_dir_all(&test_root);
    let instance_path = test_root.join("instance");
    fs::create_dir_all(&instance_path).unwrap();

    let archive_path = test_root.join("modpack.zip");
    let mut writer = ZipWriter::new(File::create(&archive_path).unwrap());
    for (name, content) in entries {
      writer
        .start_file(*name, SimpleFileOptions::default())
        .unwrap();
      writer.write_all(content.as_bytes()).unwrap();
    }
    writer.finish().unwrap();

    let archive = File::open(&archive_path).unwrap();
    extract_overrides(&archive, &instance_path).unwrap();
    test_root
  }

  #[test]
  fn extracts_prism_minecraft_directory() {
    let test_root = import_overrides(
      "prism",
      &[
        ("mmc-pack.json", MMC_PACK),
        ("instance.cfg", "name=Pack\n"),
        ("minecraft/mods/example.jar", "mod"),
        ("minecraft/options.txt", "options"),
      ],
    );
    let instance_path = test_root.join("instance");
    assert_eq!(
      fs::read_to_string(instance_path.join("mods/example.jar")).unwrap(),
      "mod"
    );
    assert_eq!(
      fs::read_to_string(instance_path.join("options.txt")).unwrap(),
      "options"
    );
    fs::remove_dir_all(test_root).unwrap();
  }

  #[test]
  fn prefers_dot_minecraft_directory() {
    let test_root = import_overrides(
      "multimc",
      &[
        ("Pack/mmc-pack.json", MMC_PACK),
        ("Pack/instance.cfg", "name=Pack\n"),
        ("Pack/.minecraft/mods/example.jar", "mod"),
        ("Pack/minecraft/mods/other.jar", "other"),
      ],
    );
    let instance_path = test_root.join("instance");
    assert!(instance_path.join("mods/example.jar").is_file());
    assert!(!instance_path.join("mods/other.jar").exists());
    fs::remove_dir_all(test_root).unwrap();
  }
}
