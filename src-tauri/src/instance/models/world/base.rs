use serde::{self, Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorldInfo {
  pub name: String,
  pub last_played_at: i64,
  pub difficulty: Option<String>,
  pub gamemode: String,
  pub icon_src: PathBuf,
  pub dir_path: PathBuf,
}
