use crate::instance::constants::INSTANCE_CFG_FILE_NAME;
use crate::instance::helpers::game_version::{compare_game_versions, get_major_game_version};
use crate::launcher_config::models::GameConfig;
use crate::storage::{load_json_async, save_json_async};
use crate::utils::image::ImageWrapper;
use serde::{Deserialize, Serialize};
use std::cmp::{Ord, Ordering, PartialOrd};
use std::path::PathBuf;
use std::str::FromStr;
use strum_macros::Display;
use tauri::AppHandle;

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

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default, Display)]
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
  pub fn to_icon_path(&self) -> &str {
    match self {
      &ModLoaderType::Unknown => "/images/icons/JEIcon_Release.png",
      &ModLoaderType::Fabric => "/images/icons/Fabric.png",
      &ModLoaderType::Forge | &ModLoaderType::LegacyForge => "/images/icons/Anvil.png",
      &ModLoaderType::NeoForge => "/images/icons/NeoForge.png",
      &ModLoaderType::LiteLoader => "/images/icons/LiteLoader.png",
      &ModLoaderType::Quilt => "/images/icons/Quilt.png",
    }
  }
}

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

structstruck::strike! {
  #[strikethrough[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]]
  #[strikethrough[serde(rename_all = "camelCase", default)]]
  pub struct Instance {
    pub id: String,
    pub name: String,
    pub description: String,
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
    load_json_async::<Self>(&self.get_json_cfg_path()).await
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
    }
  }
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LocalModInfo {
  pub icon_src: ImageWrapper,
  pub enabled: bool,
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
  FileNotFoundError,
  InvalidSourcePath,
  FileCreationFailed,
  FileCopyFailed,
  FileMoveFailed,
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

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OptiFine {
  pub filename: String,
  pub version: String,
  pub status: ModLoaderStatus,
}

impl std::error::Error for InstanceError {}
