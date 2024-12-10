use super::models::LauncherConfig;
use serde_json;
use std::{fs, path::PathBuf, sync::LazyLock};

static CONFIG_PATH: LazyLock<PathBuf> = LazyLock::new(|| {
  std::env::current_exe()
    .unwrap()
    .parent()
    .unwrap()
    .join("sjmcl.conf.json")
});

pub fn read_or_default() -> LauncherConfig {
  if let Ok(config) = fs::read_to_string(CONFIG_PATH.as_path()) {
    serde_json::from_str(&config).unwrap_or_default()
  } else {
    LauncherConfig::default()
  }
}

pub fn save_config(config: &LauncherConfig) {
  let config = serde_json::to_string_pretty(config).unwrap();
  fs::write(CONFIG_PATH.as_path(), config).unwrap();
}
