use crate::{
  error::{SJMCLError, SJMCLResult},
  instance::{
    helpers::game_version::compare_game_versions, models::misc::Instance,
    models::misc::ModLoaderType,
  },
  launcher_config::models::LauncherConfig,
  utils::fs::get_app_resource_filepath,
};
use regex::RegexBuilder;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use serde_with::{formats::PreferMany, serde_as, OneOrMany};
use std::cmp::Ordering;
use std::fs;
use std::sync::Mutex;
use std::{collections::HashMap, str::FromStr};
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct McClientInfo {
  pub id: String,
  pub inherits_from: Option<String>,

  pub arguments: Option<LaunchArgumentTemplate>, // new version
  pub minecraft_arguments: Option<String>,       // old version

  pub asset_index: AssetIndexInfo,
  pub assets: String,
  pub downloads: HashMap<String, DownloadsValue>,
  pub libraries: Vec<LibrariesValue>,
  pub logging: Logging,
  pub java_version: JavaVersion,
  #[serde(rename = "type")]
  pub type_: String,
  pub time: String,
  pub release_time: String,
  pub minimum_launcher_version: i64,
  pub patches: Vec<PatchesInfo>,
  pub main_class: String,
  pub jar: Option<String>,
  pub client_version: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct PatchesInfo {
  pub id: String,
  pub version: String,
  pub priority: i64,
  pub inherits_from: Option<String>,
  pub arguments: Option<LaunchArgumentTemplate>,
  pub minecraft_arguments: Option<String>,
  pub main_class: String,
  pub asset_index: AssetIndexInfo,
  pub assets: String,
  pub downloads: HashMap<String, DownloadsValue>,
  pub libraries: Vec<LibrariesValue>,
  pub logging: Logging,
  pub java_version: Option<JavaVersion>,
  #[serde(rename = "type")]
  pub type_: String,
  pub time: String,
  pub release_time: String,
  pub minimum_launcher_version: i64,
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct JavaVersion {
  pub component: String,
  pub major_version: i32,
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct LaunchArgumentTemplate {
  pub game: Vec<ArgumentsItem>,
  pub jvm: Vec<ArgumentsItem>,
}

#[serde_as]
#[derive(Debug, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct ArgumentsItem {
  #[serde_as(as = "OneOrMany<_, PreferMany>")]
  pub value: Vec<String>,
  pub rules: Vec<InstructionRule>,
}

#[serde_as]
#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct ArgumentsItemDefault {
  #[serde_as(as = "OneOrMany<_, PreferMany>")]
  pub value: Vec<String>,
  pub rules: Vec<InstructionRule>,
}

impl<'de> Deserialize<'de> for ArgumentsItem {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: Deserializer<'de>,
  {
    let raw_value: Value = Value::deserialize(deserializer)?;
    if let Some(val) = raw_value.as_str() {
      return Ok(ArgumentsItem {
        value: vec![val.to_string()],
        ..Default::default()
      });
    }
    let game: ArgumentsItemDefault =
      serde::de::Deserialize::deserialize(raw_value).map_err(serde::de::Error::custom)?;
    Ok(ArgumentsItem {
      value: game.value,
      rules: game.rules,
    })
  }
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct InstructionRule {
  pub action: String,
  pub features: Option<FeaturesInfo>,
  pub os: Option<OsInfo>,
}

impl InstructionRule {
  pub fn is_allowed(&self, target_feature: &FeaturesInfo) -> SJMCLResult<(bool, bool)> {
    let mut positive = match self.action.to_lowercase().as_str() {
      "allow" => true,
      "disallow" => false,
      _ => {
        return Err(SJMCLError(format!(
          "unknown action format: {}",
          self.action
        )))
      }
    };
    let mut strong = false;
    if let Some(ref os_rule) = self.os {
      strong = true;
      let mut os_string = os_rule.name.to_lowercase();
      if os_string == "osx" {
        os_string = "macos".to_string();
      }
      if os_string != "unknown" && tauri_plugin_os::type_().to_string() != os_string {
        positive = !positive;
        return Ok((positive, strong));
      }
      if let Some(ref arch_string) = os_rule.arch {
        if arch_string != "unknown" && arch_string != tauri_plugin_os::arch() {
          positive = !positive;
          return Ok((positive, strong));
        }
      }
      if let Some(ref version_string) = os_rule.version {
        let version_regex = RegexBuilder::new(version_string).build()?;
        if version_regex.is_match(tauri_plugin_os::version().to_string().as_str()) {
          return Ok((positive, strong));
        }
      }
    }
    if let Some(ref self_feature) = self.features {
      strong = true;
      if self_feature.is_demo_user.is_some() {
        if self_feature.is_demo_user != target_feature.is_demo_user {
          positive = !positive;
        }
        return Ok((positive, strong));
      }
      if self_feature.is_quick_play_multiplayer.is_some() {
        if self_feature.is_quick_play_multiplayer != target_feature.is_quick_play_multiplayer {
          positive = !positive;
        }
        return Ok((positive, strong));
      }
      if self_feature.is_quick_play_realms.is_some() {
        if self_feature.is_quick_play_realms != target_feature.is_quick_play_realms {
          positive = !positive;
        }
        return Ok((positive, strong));
      }
      if self_feature.is_quick_play_singleplayer.is_some() {
        if self_feature.is_quick_play_singleplayer != target_feature.is_quick_play_singleplayer {
          positive = !positive;
        }
        return Ok((positive, strong));
      }
      if self_feature.has_custom_resolution.is_some() {
        if self_feature.has_custom_resolution != target_feature.has_custom_resolution {
          positive = !positive;
        }
        return Ok((positive, strong));
      }
      if self_feature.has_quick_plays_support.is_some() {
        if self_feature.has_quick_plays_support != target_feature.has_quick_plays_support {
          positive = !positive;
        }
        return Ok((positive, strong));
      }
    }
    Ok((positive, strong))
  }
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct OsInfo {
  pub name: String,
  pub version: Option<String>,
  pub arch: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(default)]
pub struct FeaturesInfo {
  pub is_demo_user: Option<bool>,
  pub has_custom_resolution: Option<bool>,
  pub has_quick_plays_support: Option<bool>,
  pub is_quick_play_singleplayer: Option<bool>,
  pub is_quick_play_multiplayer: Option<bool>,
  pub is_quick_play_realms: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct AssetIndexInfo {
  pub id: String,
  pub sha1: String,
  pub size: i64,
  pub total_size: i64,
  pub url: String,
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct DownloadsValue {
  pub sha1: String,
  pub size: i64,
  pub url: String,
}

structstruck::strike! {
  #[strikethrough[derive(Debug, Deserialize, Serialize, Default, Clone)]]
  #[strikethrough[serde(rename_all="camelCase", default)]]
  pub struct LibrariesValue {
    pub name: String,
    pub downloads: Option<
      pub struct{
        pub artifact: Option<DownloadsArtifact>,
        pub classifiers: Option<HashMap<String, DownloadsArtifact>>,
      }>,
    pub natives: Option<HashMap<String, String>>,
    pub extract: Option<pub struct{
      exclude: Option<Vec<String>>,
    }>,
    pub rules: Vec<InstructionRule>,
  }
}

#[derive(Debug, Deserialize, Serialize, Default, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase", default)]
pub struct DownloadsArtifact {
  pub path: String,
  pub url: String,
  pub sha1: String,
  pub size: i64,
}

structstruck::strike! {
  #[strikethrough[derive(Debug, Deserialize, Serialize, Default, Clone)]]
  #[strikethrough[serde(rename_all="camelCase", default)]]
  pub struct Logging {
    pub client:
      pub struct {
        pub argument: String,
        pub file: pub struct {
          pub id: String,
          pub url: String,
          pub sha1: String,
          pub size: i64,
        },
        #[serde(rename="type")]
        pub type_: String,
      },
  }
}

pub fn patches_to_info(patches: &[PatchesInfo]) -> (Option<String>, Option<String>, ModLoaderType) {
  let mut loader_type = ModLoaderType::Unknown;
  let mut game_version = None;
  let mut loader_version = None;
  for patch in patches {
    if game_version.is_none() && patch.id == "game" {
      game_version = Some(patch.version.clone());
    }
    if loader_type == ModLoaderType::Unknown {
      if let Ok(found_loader_type) = ModLoaderType::from_str(&patch.id) {
        loader_type = found_loader_type;
        loader_version = Some(patch.version.clone());
      }
    }

    if game_version.is_some() && loader_type != ModLoaderType::Unknown {
      break;
    }
  }

  (game_version, loader_version, loader_type)
}

pub async fn libraries_to_info(
  client: &McClientInfo,
) -> (Option<String>, Option<String>, ModLoaderType) {
  let game_version: Option<String> = client.client_version.clone();
  let mut loader_version: Option<String> = None;
  let mut loader_type = ModLoaderType::Unknown;

  for lib in &client.libraries {
    let parts: Vec<_> = lib.name.splitn(3, ':').collect();
    if parts.len() != 3 {
      continue;
    }
    let (g, a, v) = (parts[0], parts[1], parts[2]);
    match (g, a) {
      ("net.fabricmc", "fabric-loader") => {
        loader_type = ModLoaderType::Fabric;
        loader_version = Some(v.to_string());
        break;
      }
      ("org.quiltmc", "quilt-loader") => {
        loader_type = ModLoaderType::Quilt;
        loader_version = Some(v.to_string());
        break;
      }
      ("net.neoforged", "neoforge") => {
        loader_type = ModLoaderType::NeoForge;
        loader_version = Some(v.to_string());
        break;
      }
      ("net.minecraftforge", "forge") | ("net.minecraftforge", "fmlloader") => {
        loader_type = ModLoaderType::Forge;
        if let Some((_, forge)) = v.split_once('-') {
          loader_version = Some(forge.to_string());
        } else {
          loader_version = Some(v.to_string());
        }
        break;
      }
      ("com.mumfrey", "liteloader") => {
        loader_type = ModLoaderType::LiteLoader;
        loader_version = Some(v.to_string());
        break;
      }
      _ => {}
    }
  }

  (game_version, loader_version, loader_type)
}

fn rules_is_allowed(rules: &Vec<InstructionRule>, feature: &FeaturesInfo) -> SJMCLResult<bool> {
  let mut weak_allowed = true;
  for rule in rules {
    let (allow, strong) = rule.is_allowed(feature)?;
    if strong {
      return Ok(allow);
    }
    weak_allowed = allow;
  }
  Ok(weak_allowed)
}

pub trait IsAllowed {
  fn is_allowed(&self, feature: &FeaturesInfo) -> SJMCLResult<bool>;
}

impl IsAllowed for ArgumentsItem {
  fn is_allowed(&self, feature: &FeaturesInfo) -> SJMCLResult<bool> {
    rules_is_allowed(&self.rules, feature)
  }
}

impl IsAllowed for LibrariesValue {
  fn is_allowed(&self, feature: &FeaturesInfo) -> SJMCLResult<bool> {
    rules_is_allowed(&self.rules, feature)
  }
}

impl LaunchArgumentTemplate {
  pub fn to_jvm_arguments(&self, feature: &FeaturesInfo) -> SJMCLResult<Vec<String>> {
    let mut arguments = Vec::new();
    for argument in &self.jvm {
      if argument.is_allowed(feature).unwrap_or_default() {
        arguments.extend(argument.value.clone());
      }
    }
    Ok(arguments)
  }
  pub fn to_game_arguments(&self, feature: &FeaturesInfo) -> SJMCLResult<Vec<String>> {
    let mut arguments = Vec::new();
    for argument in &self.game {
      if argument.is_allowed(feature).unwrap_or_default() {
        arguments.extend(argument.value.clone());
      }
    }
    Ok(arguments)
  }
}

// The following two functions are adapted from HMCL.
// They replace libraries such as LWJGL in version JSONs for older Minecraft versions and specific platforms, using replacement resources contributed by the HMCL community.
// ref: https://github.com/HMCL-dev/HMCL/blob/main/HMCL/src/main/resources/assets/natives.json
pub fn load_native_libraries_replace_map(
  app: &AppHandle,
) -> SJMCLResult<HashMap<String, HashMap<String, Option<LibrariesValue>>>> {
  let path = get_app_resource_filepath(app, "assets/game/natives.json")?;
  let txt =
    fs::read_to_string(&path).map_err(|e| SJMCLError(format!("read natives.json failed: {e}")))?;
  let map: HashMap<String, HashMap<String, Option<LibrariesValue>>> = serde_json::from_str(&txt)
    .map_err(|e| SJMCLError(format!("parse natives.json failed: {e}")))?;
  Ok(map)
}

pub async fn replace_native_libraries(
  app: &AppHandle,
  client_info: &mut McClientInfo,
  instance: &Instance,
) -> SJMCLResult<()> {
  #[cfg(any(
    all(
      any(target_arch = "x86", target_arch = "x86_64"),
      any(target_os = "linux", target_os = "macos")
    ),
    target_os = "windows"
  ))]
  {
    return Ok(());
  }

  #[cfg(all(target_arch = "aarch64", target_os = "macos"))]
  {
    if compare_game_versions(app, instance.version.as_str(), "1.20.1", true).await
      == Ordering::Greater
    {
      return Ok(());
    }
  }

  let all_replace_map = load_native_libraries_replace_map(app)?;

  let (os, arch) = {
    let launcher_config_state = app.state::<Mutex<LauncherConfig>>();
    let cfg = launcher_config_state.lock().unwrap();
    (cfg.basic_info.os_type.clone(), cfg.basic_info.arch.clone())
  };
  let platform_key = format!("{}-{}", os.to_lowercase(), arch.to_lowercase());
  let platform_map = match all_replace_map.get(platform_key.as_str()) {
    Some(m) if !m.is_empty() => m,
    _ => {
      return Ok(());
    }
  };

  for lib in &mut client_info.libraries {
    let key = lib.name.clone();

    if lib.natives.is_some() {
      let natives_key = format!("{key}:natives");
      if let Some(Some(new_lib)) = platform_map.get(&natives_key) {
        lib.name = new_lib.name.clone();
        if new_lib.downloads.is_some() {
          lib.downloads = new_lib.downloads.clone();
        }
        if new_lib.natives.is_some() {
          lib.natives = new_lib.natives.clone();
        }
        if new_lib.extract.is_some() {
          lib.extract = new_lib.extract.clone();
        }
        continue;
      }
    }

    if let Some(Some(new_lib_opt)) = platform_map.get(&key) {
      lib.name = new_lib_opt.name.clone();
      if new_lib_opt.downloads.is_some() {
        lib.downloads = new_lib_opt.downloads.clone();
      }
      if new_lib_opt.natives.is_some() {
        lib.natives = new_lib_opt.natives.clone();
      }
      if new_lib_opt.extract.is_some() {
        lib.extract = new_lib_opt.extract.clone();
      }
    }
  }
  Ok(())
}
