use serde::{Deserialize, Serialize};
use smart_default::SmartDefault;
use strum_macros::Display;

use crate::account::models::PlayerInfo;
use crate::instance::helpers::client_json::McClientInfo;
use crate::instance::models::misc::Instance;
use crate::launch::helpers::lwjgl3ify::Lwjgl3ifyLaunchInfo;
use crate::launcher_config::models::{GameConfig, JavaInfo};

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum LaunchError {
  ModLoaderNotInstalled,
  NoSuitableJava,
  SelectedJavaUnavailable,
  GameFilesIncomplete,
  SetProcessPriorityFailed,
  ChangeWindowTitleFailed,
  KillProcessFailed,
  LaunchingStateNotFound,
  AuthlibInjectorNotReady,
  AuthServerNotFound,
  Lwjgl3ifyInvalidMetadata,
  Lwjgl3ifyDuplicateMods,
  Lwjgl3ifyJavaIncompatible,
  Lwjgl3ifyConflictingArguments,
  Lwjgl3ifyPreparationFailed,
  Lwjgl3ifyModChanged,
  Lwjgl3ifyUnsupportedPlatform,
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
  #[serde(skip)]
  pub lwjgl3ify: Option<Lwjgl3ifyLaunchInfo>,
  pub selected_player: Option<PlayerInfo>, // use Option to avoid SmartDefault trait error
  pub auth_server_meta: Option<String>,
  pub full_command: String, // for export and debug
  #[default = 0] // default means not set yet
  pub pid: u32,
}
