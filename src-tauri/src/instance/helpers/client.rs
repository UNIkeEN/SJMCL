use crate::{
  error::{SJMCLError, SJMCLResult},
  instance::models::misc::ModLoaderType,
};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use std::{collections::HashMap, path::PathBuf, str::FromStr};

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct McClientInfo {
  pub id: String,
  pub arguments: Arguments,
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
  pub patches: Vec<PatchesInfo>,
}

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct PatchesInfo {
  pub id: String,
  pub version: String,
  pub priority: i64,
  pub arguments: Arguments,
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

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct JavaVersion {
  pub component: String,
  pub major_version: i64,
}

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Arguments {
  pub game: Vec<ArgumentsItem>,
  pub jvm: Vec<ArgumentsItem>,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ArgumentsItem {
  pub value: Vec<String>,
  pub rules: Vec<InstructionRule>,
}

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ArgumentsItemDefault {
  pub value: Vec<String>,
  pub rules: Vec<InstructionRule>,
}

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct InstructionRule {
  pub action: String,
  pub features: Option<FeaturesInfo>,
  pub os: Option<OsInfo>,
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

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct OsInfo {
  pub name: String,
  pub version: Option<String>,
  pub arch: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(default)]
pub struct FeaturesInfo {
  pub is_demo_user: Option<bool>,
  pub has_custom_resolution: Option<bool>,
  pub has_quick_plays_support: Option<bool>,
  pub is_quick_play_singleplayer: Option<bool>,
  pub is_quick_play_multiplayer: Option<bool>,
  pub is_quick_play_realms: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct AssetIndex {
  pub id: String,
  pub sha1: String,
  pub size: i64,
  pub total_size: i64,
  pub url: String,
}

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct DownloadsValue {
  pub sha1: String,
  pub size: i64,
  pub url: String,
}

structstruck::strike! {
  #[strikethrough[derive(Debug, Deserialize, Serialize, Default)]]
  #[strikethrough[serde(rename_all="camelCase", default)]]
  pub struct LibrariesValue {
    pub name: String,
    pub downloads: Option<
      pub struct{
        pub artifact: Option<DownloadsArtifact>,
        pub classifiers: Option<Classifiers>
      }>,
    pub natives: Option<Value>,
    pub extract: Option<Value>,
    pub rules: Option<Vec<pub struct{
      pub action: String,
      pub os: Option<pub struct{
        pub name: String,
      }>
    }>>,
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

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "snake_case", default)]
pub struct Classifiers {
  pub natives_linux: Option<Value>,
  pub natives_macos: Option<Value>,
  pub natives_osx: Option<Value>,
  pub natives_windows: Option<Value>,
  pub javadoc: Option<Value>,
  pub sources: Option<Value>,
}

structstruck::strike! {
  #[strikethrough[derive(Debug, Deserialize, Serialize, Default)]]
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

pub async fn load_client_info_from_json(path: &PathBuf) -> SJMCLResult<McClientInfo> {
  let client_string = tokio::fs::read_to_string(&path).await?;
  let meta = match serde_json::from_str::<McClientInfo>(&client_string) {
    Ok(val) => val,
    Err(e) => {
      println!("DESERIALIZE ERROR: {:?}", e);
      return Err(SJMCLError::from(e));
    }
  };
  Ok(meta)
}

pub fn patchs_to_info(patches: &[PatchesInfo]) -> (Option<String>, Option<String>, ModLoaderType) {
  let mut mod_loader_type = ModLoaderType::Unknown;
  let mut game_version = None;
  let mut mod_version = None;
  if !patches.is_empty() {
    game_version = Some(patches[0].version.clone());
  }
  if patches.len() > 1 {
    if let Ok(val) = ModLoaderType::from_str(&patches[1].id) {
      mod_loader_type = val;
    }
    mod_version = Some(patches[1].version.clone())
  }
  (game_version, mod_version, mod_loader_type)
}
