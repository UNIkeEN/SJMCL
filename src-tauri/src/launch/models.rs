use crate::account::models::PlayerInfo;
use crate::instance::helpers::client_json::McClientInfo;
use crate::instance::models::misc::Instance;
use crate::launcher_config::models::{GameConfig, JavaInfo};
use serde::{Deserialize, Serialize};
use smart_default::SmartDefault;

#[derive(Debug)]
pub enum LaunchError {
  ModLoaderNotInstalled,
  NoSuitableJava(i32),
  SelectedJavaUnavailable,
  GameFilesIncomplete,
  SetProcessPriorityFailed,
  ChangeWindowTitleFailed,
  KillProcessFailed,
  LaunchingStateNotFound,
}

impl std::fmt::Display for LaunchError {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      LaunchError::ModLoaderNotInstalled => write!(f, "MOD_LOADER_NOT_INSTALLED"),
      LaunchError::NoSuitableJava(version) => write!(f, "NO_SUITABLE_JAVA({})", version),
      LaunchError::SelectedJavaUnavailable => write!(f, "SELECTED_JAVA_UNAVAILABLE"),
      LaunchError::GameFilesIncomplete => write!(f, "GAME_FILES_INCOMPLETE"),
      LaunchError::SetProcessPriorityFailed => write!(f, "SET_PROCESS_PRIORITY_FAILED"),
      LaunchError::ChangeWindowTitleFailed => write!(f, "CHANGE_WINDOW_TITLE_FAILED"),
      LaunchError::KillProcessFailed => write!(f, "KILL_PROCESS_FAILED"),
      LaunchError::LaunchingStateNotFound => write!(f, "LAUNCHING_STATE_NOT_FOUND"),
    }
  }
}

impl std::error::Error for LaunchError {}

#[derive(Debug, Clone, Serialize, Deserialize, SmartDefault)]
#[serde(rename_all = "camelCase", default)]
pub struct LaunchingState {
  pub id: u64,
  #[default = 1]
  pub current_step: usize,
  // shared variables between steps.
  pub selected_java: JavaInfo,
  pub selected_instance: Instance,
  pub game_config: GameConfig,
  pub client_info: McClientInfo,
  pub selected_player: Option<PlayerInfo>, // use Option to avoid SmartDefault trait error
  pub auth_server_meta: String,
  pub full_command: String, // for export and debug
  #[default = 0] // default means not set yet
  pub pid: u32,
}
