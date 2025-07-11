use crate::{
  error::{SJMCLError, SJMCLResult},
  instance::models::misc::ModLoaderType,
};
use regex::RegexBuilder;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use serde_with::{formats::PreferMany, serde_as, OneOrMany};
use std::{collections::HashMap, str::FromStr};

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct McClientInfo {
  pub id: String,

  pub arguments: Option<LaunchArgumentTemplate>, // new version
  pub minecraft_arguments: Option<String>,       // old version

  pub asset_index: AssetIndex,
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
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct PatchesInfo {
  pub id: String,
  pub version: String,
  pub priority: i64,
  pub arguments: LaunchArgumentTemplate,
  pub main_class: String,
  pub asset_index: AssetIndex,
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
pub struct AssetIndex {
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

pub fn patchs_to_info(patches: &[PatchesInfo]) -> (Option<String>, Option<String>, ModLoaderType) {
  let mut loader_type = ModLoaderType::Unknown;
  let mut game_version = None;
  let mut loader_version = None;
  if !patches.is_empty() {
    game_version = Some(patches[0].version.clone());
  }
  if patches.len() > 1 {
    if let Ok(val) = ModLoaderType::from_str(&patches[1].id) {
      loader_type = val;
    }
    loader_version = Some(patches[1].version.clone())
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
