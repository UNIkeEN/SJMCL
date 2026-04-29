pub use sjmcl_launcher_config::models::*;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JavaInfo {
  pub name: String, // JDK/JRE + full version
  pub exec_path: String,
  pub vendor: String,
  pub major_version: i32, // major version + LTS flag
  pub is_lts: bool,
  pub is_user_added: bool,
}

// Info about the latest release version fetched from remote, shown to the user to update.
#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VersionMetaInfo {
  pub version: String,
  pub file_name: String,
  pub release_notes: String,
  pub published_at: String,
}
