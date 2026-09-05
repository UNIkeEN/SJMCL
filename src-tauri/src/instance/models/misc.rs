use serde::{Deserialize, Serialize};
use serde_json::Value;
use sjmcl_migration::migrate;
use sjmcl_types::storage::save_json_async;
use smart_default::SmartDefault;
use std::cmp::{Ord, Ordering, PartialOrd};
use std::path::PathBuf;
use std::str::FromStr;
use strum_macros::Display;
use tauri::AppHandle;

use crate::instance::constants::INSTANCE_CFG_FILE_NAME;
use crate::instance::helpers::game_version::{compare_game_versions, get_major_game_version};
use crate::launcher_config::models::GameConfig;
use crate::utils::image::ImageWrapper;

#[derive(Debug, Deserialize, Serialize)]
pub enum InstanceSubdirType {
  Assets,
  Libraries,
  Mods,
  NativeLibraries,
  ResourcePacks,
  Root,
  Saves,
  Schematics,
  Screenshots,
  ServerResourcePacks,
  ShaderPacks,
}

sjmcl_macros::migrations! {
  schema v1.2.0 {
    #[structstruck::each[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, SmartDefault)]]
    #[structstruck::each[serde(rename_all = "camelCase", default)]]
    pub struct Instance {
      // Config format version (the `version` field is the Minecraft version).
      #[default(_code = "__migration_meta::MAX_VERSION.to_string()")]
      pub config_version: String,
      pub id: String,
      pub name: String,
      pub description: String,
      pub tag: Option<String>,
      pub icon_src: String,
      pub starred: bool,
      pub play_time: u128,
      pub version: String,
      pub version_path: PathBuf,
      pub mod_loader: struct {
        pub status: ModLoaderStatus,
        pub loader_type: ModLoaderType,
        pub version: String,
        pub branch: Option<String>, // Optional branch name for mod loaders like Forge
      },
      pub optifine: Option<OptiFine>,
      // if true, use the spec_game_config, else use the global game config
      pub use_spec_game_config: bool,
      // if use_spec_game_config is false, this field is ignored
      pub spec_game_config: Option<GameConfig>,
      pub modpack_version: Option<String>,
    }
    #[aux]
    #[derive(Debug, PartialEq, Eq, Clone, Copy, Deserialize, Serialize, Default, Display)]
    pub enum ModLoaderType {
      #[default]
      Unknown,
      Fabric,
      Forge,
      LegacyForge,
      NeoForge,
      LiteLoader,
      Quilt,
    }
    #[aux]
    #[derive(Debug, PartialEq, Eq, Deserialize, Clone, Serialize, Default)]
    pub enum ModLoaderStatus {
      NotDownloaded, // mod loader's library has not been downloaded
      DownloadFailed, /* mod loader's library download process failed (including processor installation failed)
                      Only when SJMCL restart, it will try to re-download library while making no changes to client info JSON (is_retry = true),
                      and do following steps */
      Downloading, // mod loader's library download process is ongoing
      Installing,  // mod loader's library has been downloaded, and installation processors are working
      #[default]
      Installed,
    }
    #[aux]
    #[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
    #[serde(rename_all = "camelCase")]
    pub struct OptiFine {
      pub filename: String,
      pub version: String,
      pub status: ModLoaderStatus,
    }
  }
  // Legacy instance configs (written before format versioning) carry no
  // `configVersion` key and fall back to the chain-start version (v1.0.0).
  v1.0.0 -> v1.1.0 {}
  v1.1.0 -> v1.2.0 {}
}

impl FromStr for ModLoaderType {
  type Err = String;

  fn from_str(input: &str) -> Result<Self, Self::Err> {
    match input.to_lowercase().as_str() {
      "unknown" => Ok(ModLoaderType::Unknown),
      "fabric" => Ok(ModLoaderType::Fabric),
      "forge" => Ok(ModLoaderType::Forge),
      "legacyforge" => Ok(ModLoaderType::LegacyForge),
      "neoforge" => Ok(ModLoaderType::NeoForge),
      "liteloader" => Ok(ModLoaderType::LiteLoader),
      "quilt" => Ok(ModLoaderType::Quilt),
      _ => Err(format!("Unsupported ModLoaderType: {}", input)),
    }
  }
}

impl ModLoaderType {
  pub fn to_icon_path(self) -> &'static str {
    match self {
      ModLoaderType::Unknown => "/images/icons/JEIcon_Release.png",
      ModLoaderType::Fabric => "/images/icons/Fabric.png",
      ModLoaderType::Forge | ModLoaderType::LegacyForge => "/images/icons/Forge.png",
      ModLoaderType::NeoForge => "/images/icons/NeoForge.png",
      ModLoaderType::LiteLoader => "/images/icons/LiteLoader.png",
      ModLoaderType::Quilt => "/images/icons/Quilt.png",
    }
  }
}

impl Instance {
  pub fn get_json_cfg_path(&self) -> PathBuf {
    self.version_path.join(INSTANCE_CFG_FILE_NAME)
  }

  pub async fn load_json_cfg(&self) -> Result<Self, std::io::Error>
  where
    Self: Sized + serde::de::DeserializeOwned + Send,
  {
    let json_string = tokio::fs::read_to_string(self.get_json_cfg_path()).await?;
    let mut value: Value = serde_json::from_str(&json_string)?;
    // Config files written before 1.1.0 carry no `configVersion` key; migrate()
    // falls back to the chain-start version and applies the declared steps.
    migrate(&mut value, &MIGRATIONS, None, "configVersion").map_err(std::io::Error::other)?;
    serde_json::from_value(value).map_err(std::io::Error::other)
  }

  pub async fn save_json_cfg(&self) -> Result<(), std::io::Error> {
    save_json_async(self, &self.get_json_cfg_path()).await
  }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InstanceSummary {
  pub id: String,
  pub name: String,
  pub description: String,
  pub tag: Option<String>,
  pub icon_src: String,
  pub starred: bool,
  pub play_time: u128,
  pub version_path: PathBuf,
  pub version: String,
  pub major_version: String,
  pub mod_loader: ModLoader,
  pub optifine: Option<OptiFine>,
  pub support_quick_play: bool,
  pub use_spec_game_config: bool,
  pub is_version_isolated: bool,
  pub modpack_version: Option<String>,
}

impl InstanceSummary {
  pub async fn from_instance(
    app: &AppHandle,
    id: String,
    instance: &Instance,
    is_version_isolated: bool,
  ) -> Self {
    InstanceSummary {
      id,
      name: instance.name.clone(),
      description: instance.description.clone(),
      tag: instance.tag.clone(),
      icon_src: instance.icon_src.clone(),
      starred: instance.starred,
      play_time: instance.play_time,
      version_path: instance.version_path.clone(),
      version: instance.version.clone(),
      mod_loader: instance.mod_loader.clone(),
      optifine: instance.optifine.clone(),
      // skip fallback remote fetch in `get_major_game_version` and `compare_game_versions` to avoid instance list load delay.
      // ref: https://github.com/UNIkeEN/SJMCL/pull/799
      major_version: get_major_game_version(app, &instance.version, false).await,
      support_quick_play: compare_game_versions(app, &instance.version, "23w14a", false)
        .await
        .is_ge(),
      use_spec_game_config: instance.use_spec_game_config,
      is_version_isolated,
      modpack_version: instance.modpack_version.clone(),
    }
  }
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LocalModInfo {
  pub icon_src: ImageWrapper,
  pub enabled: bool,
  pub mod_id: String,
  pub name: String,
  pub translated_name: Option<String>,
  pub version: String,
  pub loader_type: ModLoaderType,
  pub file_name: String,
  pub file_path: PathBuf,
  pub description: String,
  pub translated_description: Option<String>,
  pub potential_incompatibility: bool,
}

impl PartialEq for LocalModInfo {
  fn eq(&self, other: &Self) -> bool {
    self.name.to_lowercase() == other.name.to_lowercase() && self.version == other.version
  }
}

impl Eq for LocalModInfo {}

impl PartialOrd for LocalModInfo {
  fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
    Some(self.cmp(other))
  }
}
impl Ord for LocalModInfo {
  fn cmp(&self, other: &Self) -> Ordering {
    match self.name.to_lowercase().cmp(&other.name.to_lowercase()) {
      Ordering::Equal => self.version.cmp(&other.version),
      order => order,
    }
  }
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResourcePackInfo {
  pub name: String,
  pub description: String,
  // TODO: is Option necessary?
  pub icon_src: Option<ImageWrapper>,
  pub file_path: PathBuf,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SchematicInfo {
  pub name: String,
  pub file_path: PathBuf,
  pub relative_path: PathBuf,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShaderPackInfo {
  pub file_name: String,
  pub file_path: PathBuf,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScreenshotInfo {
  pub file_name: String,
  pub file_path: PathBuf,
  pub time: u64,
}

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum InstanceError {
  InstanceNotFoundByID,
  ServerNbtReadError,
  DuplicateServer,
  FileNotFoundError,
  InvalidSourcePath,
  FileCreationFailed,
  FileCopyFailed,
  FileMoveFailed,
  FileOperationError,
  FolderCreationFailed,
  ShortcutCreationFailed,
  ZipFileProcessFailed,
  WorldNotExistError,
  LevelParseError,
  LevelNotExistError,
  ConflictNameError,
  InvalidNameError,
  ClientJsonParseError,
  AssetIndexParseError,
  InstallProfileParseError,
  ModLoaderVersionParseError,
  ModpackManifestParseError,
  CurseForgeFileManifestParseError,
  NetworkError,
  UnsupportedModLoader,
  NotSupportChangeModLoader,
  MainClassNotFound,
  InstallationDuplicated,
  ProcessorExecutionFailed,
  SemaphoreAcquireFailed,
  LoaderInstallerNotFound,
}

impl std::error::Error for InstanceError {}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModpackFileList {
  pub all: Vec<String>,
  pub unchecked: Vec<String>,
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn migrate_fills_config_version_for_legacy_instance() {
    // A pre-1.1.0 instance config has no `configVersion` key; migrate() falls
    // back to the chain-start version and stamps the current version. The
    // Minecraft `version` key must be left untouched.
    let mut doc: Value = serde_json::json!({
      "id": "test:instance",
      "version": "26.3-snapshot-9",
    });
    migrate(&mut doc, &MIGRATIONS, None, "configVersion").unwrap();
    assert_eq!(doc["configVersion"], "1.1.0");
    assert_eq!(doc["version"], "26.3-snapshot-9");
  }

  #[test]
  fn migrate_keeps_current_config_version_unchanged() {
    let mut doc: Value = serde_json::json!({
      "configVersion": "1.1.0",
      "version": "1.20.1",
    });
    migrate(&mut doc, &MIGRATIONS, None, "configVersion").unwrap();
    assert_eq!(doc["configVersion"], "1.1.0");
    assert_eq!(doc["version"], "1.20.1");
  }

  #[test]
  fn default_config_version_is_max_version() {
    assert_eq!(Instance::default().config_version, "1.1.0");
  }
}
