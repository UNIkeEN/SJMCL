use crate::error::SJMCLResult;
use crate::instance::export::common::ExportModpackOptions;
use crate::instance::models::misc::{Instance, ModLoaderType};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MCBBSManifest {
  pub manifest_type: String,
  pub manifest_version: u32,
  pub name: String,
  pub version: String,
  pub author: String,
  pub description: String,
  pub addons: Vec<MCBBSAddon>,
  pub files: Vec<MCBBSFile>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MCBBSAddon {
  pub id: String,
  pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MCBBSFile {
  pub path: String,
  #[serde(rename = "type")]
  pub file_type: String,
  pub force: bool,
  pub hash: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeCompatManifest {
  pub manifest_type: String,
  pub manifest_version: u32,
  pub name: String,
  pub version: String,
  pub author: String,
  pub overrides: String,
  pub minecraft: CurseForgeMinecraft,
  pub files: Vec<CurseForgeFile>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeMinecraft {
  pub version: String,
  pub mod_loaders: Vec<CurseForgeModLoader>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CurseForgeModLoader {
  pub id: String,
  pub primary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeFile {
  pub project_id: u32,
  pub file_id: u32,
  pub required: bool,
}

/// Generate MCBBS format manifest (mcbbs.packmeta)
pub fn generate_mcbbs_manifest(
  instance: &Instance,
  options: &ExportModpackOptions,
) -> SJMCLResult<MCBBSManifest> {
  let mut addons = Vec::new();

  // Add Minecraft addon
  addons.push(MCBBSAddon {
    id: "minecraft".to_string(),
    version: instance.version.clone(),
  });

  // Add mod loader addon if present
  if instance.mod_loader.loader_type != ModLoaderType::Unknown {
    let version = &instance.mod_loader.version;
    let loader_id = match instance.mod_loader.loader_type {
      ModLoaderType::Forge | ModLoaderType::LegacyForge => "forge",
      ModLoaderType::NeoForge => "neoforge",
      ModLoaderType::Fabric => "fabric",
      ModLoaderType::Quilt => "quilt",
      _ => "",
    };

    if !loader_id.is_empty() {
      addons.push(MCBBSAddon {
        id: loader_id.to_string(),
        version: version.clone(),
      });
    }
  }

  Ok(MCBBSManifest {
    manifest_type: "minecraftModpack".to_string(),
    manifest_version: 2,
    name: options.name.clone(),
    version: options.version.clone(),
    author: options.author.clone().unwrap_or_default(),
    description: options.description.clone().unwrap_or_default(),
    addons,
    files: Vec::new(),
  })
}

/// Generate CurseForge compatible manifest (manifest.json)
pub fn generate_curseforge_compat_manifest(
  instance: &Instance,
  options: &ExportModpackOptions,
) -> SJMCLResult<CurseForgeCompatManifest> {
  let mut mod_loaders = Vec::new();

  // Add mod loader if present
  if instance.mod_loader.loader_type != ModLoaderType::Unknown {
    let version = &instance.mod_loader.version;
    let loader_id = match instance.mod_loader.loader_type {
      ModLoaderType::Forge | ModLoaderType::LegacyForge => format!("forge-{}", version),
      ModLoaderType::Fabric => format!("fabric-{}", version),
      ModLoaderType::NeoForge => format!("neoforge-{}", version),
      ModLoaderType::Quilt => format!("quilt-{}", version),
      _ => String::new(),
    };

    if !loader_id.is_empty() {
      mod_loaders.push(CurseForgeModLoader {
        id: loader_id,
        primary: true,
      });
    }
  }

  Ok(CurseForgeCompatManifest {
    manifest_type: "minecraftModpack".to_string(),
    manifest_version: 1,
    name: options.name.clone(),
    version: options.version.clone(),
    author: options.author.clone().unwrap_or_default(),
    overrides: "overrides".to_string(),
    minecraft: CurseForgeMinecraft {
      version: instance.version.clone(),
      mod_loaders,
    },
    files: Vec::new(),
  })
}
