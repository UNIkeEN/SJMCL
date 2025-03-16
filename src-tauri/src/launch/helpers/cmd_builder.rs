// https://zh.minecraft.wiki/w/%E5%AE%A2%E6%88%B7%E7%AB%AF%E6%A0%B8%E5%BF%83%E6%96%87%E4%BB%B6

use super::file_validator::get_class_paths;
use crate::account::models::AccountInfo;
use crate::instance::{
  helpers::client_json::{FeaturesInfo, McClientInfo},
  models::misc::Instance,
};
use crate::launcher_config::models::LauncherConfig;
use crate::storage::Storage;
use crate::{
  error::{SJMCLError, SJMCLResult},
  instance::helpers::client_json::LaunchArgumentTemplate,
};
use regex::Regex;
use serde::{self, Deserialize, Serialize};
use shlex;
use std::collections::HashMap;
use std::fs;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Default)]
pub struct LaunchParams {
  //游戏基本参数
  pub assets_root: String,
  pub assets_index_name: String,
  pub game_directory: String,
  // pub resource_pack_dir: String, // 尚未遇见
  pub version_name: String,
  pub version_type: String,
  pub natives_directory: String,
  pub launcher_name: String,
  pub launcher_version: String,
  pub classpath: Vec<String>,
  // 授权与登陆选项
  pub auth_access_token: String,
  pub auth_player_name: String,
  pub user_type: String,
  pub auth_uuid: String,
  pub clientid: Option<String>,
  pub auth_xuid: Option<String>,

  // 游戏状态参数
  pub demo: bool,
  // pub disable_multiplayer: bool,
  // pub disable_chat: bool,
  // pub jdr_profile: bool,
  // pub tracy: bool,
  // pub tracy_no_images: bool,

  // 显示参数
  // pub full_screen: bool,
  // pub full_screen_height: i64,
  // pub full_screen_width: i64,
  pub resolution_height: u32,
  pub resolution_width: u32,

  // 快速进入游戏设置
  #[serde(rename = "quickPlayPath")]
  pub quick_play_path: String,
  #[serde(rename = "quickPlaySingleplayer")]
  pub quick_play_singleplayer: String,
  #[serde(rename = "quickPlayMultiplayer")]
  pub quick_play_multiplayer: String,
  #[serde(rename = "quickPlayRealms")]
  pub quick_play_realms: String,
  // 代理设置
  // pub proxy_host: String,
  // pub proxy_port: String,
  // pub proxy_user: String,
  // pub proxy_pass: String,

  // 无作用选项
  // pub check_gl_errors: bool,
}

impl LaunchParams {
  pub fn to_hashmap(&self) -> HashMap<String, String> {
    let mut map: HashMap<String, String> = HashMap::new();
    map.insert(
      "assets_root".to_string(),
      shlex::quote(self.assets_root.as_str()).to_string(),
    );
    map.insert(
      "assets_index_name".to_string(),
      shlex::quote(self.assets_index_name.as_str()).to_string(),
    );
    map.insert(
      "game_directory".to_string(),
      shlex::quote(self.game_directory.as_str()).to_string(),
    );
    map.insert(
      "version_name".to_string(),
      shlex::quote(self.version_name.as_str()).to_string(),
    );
    map.insert(
      "version_type".to_string(),
      shlex::quote(self.version_type.as_str()).to_string(),
    );
    map.insert(
      "natives_directory".to_string(),
      shlex::quote(self.natives_directory.as_str()).to_string(),
    );
    map.insert(
      "launcher_name".to_string(),
      shlex::quote(self.launcher_name.as_str()).to_string(),
    );
    map.insert(
      "launcher_version".to_string(),
      shlex::quote(self.launcher_version.as_str()).to_string(),
    );
    map.insert(
      "classpath".to_string(),
      self
        .classpath
        .iter()
        .map(|f| shlex::quote(f.as_str()).to_string())
        .collect::<Vec<String>>()
        .join(":")
        .to_string(),
    );
    map.insert(
      "auth_access_token".to_string(),
      shlex::quote(self.auth_access_token.as_str()).to_string(),
    );
    map.insert(
      "auth_player_name".to_string(),
      shlex::quote(self.auth_player_name.as_str()).to_string(),
    );
    map.insert(
      "user_type".to_string(),
      shlex::quote(self.user_type.as_str()).to_string(),
    );
    map.insert(
      "auth_uuid".to_string(),
      shlex::quote(self.auth_uuid.as_str()).to_string(),
    );
    if let Some(ref clientid) = &self.clientid {
      map.insert(
        "clientid".to_string(),
        shlex::quote(clientid.as_str()).to_string(),
      );
    }
    if let Some(ref auth_xuid) = &self.auth_xuid {
      map.insert(
        "auth_xuid".to_string(),
        shlex::quote(auth_xuid.as_str()).to_string(),
      );
    }
    map.insert("demo".to_string(), self.demo.to_string());
    map.insert(
      "resolution_height".to_string(),
      self.resolution_height.to_string(),
    );
    map.insert(
      "resolution_width".to_string(),
      self.resolution_width.to_string(),
    );
    map.insert(
      "quickPlayPath".to_string(),
      shlex::quote(self.quick_play_path.as_str()).to_string(),
    );
    map.insert(
      "quickPlaySingleplayer".to_string(),
      shlex::quote(self.quick_play_singleplayer.as_str()).to_string(),
    );
    map.insert(
      "quickPlayMultiplayer".to_string(),
      shlex::quote(self.quick_play_multiplayer.as_str()).to_string(),
    );
    map.insert(
      "quickPlayRealms".to_string(),
      shlex::quote(self.quick_play_realms.as_str()).to_string(),
    );
    map
  }
}

pub fn generate_launch_cmd(
  params: &LaunchParams,
  argument_template: &LaunchArgumentTemplate,
  main_class: String,
  launch_feature: &FeaturesInfo,
) -> SJMCLResult<Vec<String>> {
  lazy_static::lazy_static!(
      static ref PARAM_REGEX: Regex = Regex::new(r"\$\{(\S+)\}").unwrap();
  );
  let map = params.to_hashmap();
  let mut result = Vec::new();
  for arg in argument_template.to_arguments(launch_feature, main_class)? {
    let mut replaced_arg = arg.clone();
    let mut unknown_arg = false;

    for caps in PARAM_REGEX.captures_iter(&arg) {
      let arg_name = &caps[1];
      match map.get(arg_name) {
        Some(value) => {
          replaced_arg = replaced_arg.replacen(&caps[0], value, 1);
        }
        None => {
          unknown_arg = true;
          break;
        }
      }
    }
    if !unknown_arg {
      result.push(replaced_arg);
    } else {
      result.push(arg);
    }
  }

  Ok(result)
}

pub fn collect_launch_params(
  app: &AppHandle,
  instance_id: &usize,
  client_info: McClientInfo,
) -> SJMCLResult<(LaunchParams, FeaturesInfo)> {
  let sjmcl_config = app.state::<Mutex<LauncherConfig>>().lock()?.clone();
  let mut account_info: AccountInfo = Storage::load().unwrap_or_default();
  // TODO: select user
  let selected_user = account_info
    .players
    .pop()
    .ok_or(SJMCLError("empty users".to_string()))?;
  let instance = app
    .state::<Mutex<Vec<Instance>>>()
    .lock()?
    .get(*instance_id)
    .ok_or(SJMCLError("instance not found".to_string()))?
    .clone();
  let game_dir = instance
    .version_path
    .parent()
    .ok_or(SJMCLError("PATH NOT FOUND".to_string()))?
    .parent()
    .ok_or(SJMCLError("PATH NOT FOUND".to_string()))?;
  let assets_dir = game_dir.join("assets");
  let libraries_dir = game_dir.join("libraries");
  let version_dir = game_dir.join("versions").join(&instance.name);
  let mut class_paths = get_class_paths(&client_info, &libraries_dir);
  let game_name = instance
    .version_path
    .file_name()
    .unwrap()
    .to_string_lossy()
    .to_string();
  class_paths.push(
    version_dir
      .join(format!("{}.jar", game_name))
      .to_string_lossy()
      .to_string(),
  );
  // https://github.com/HMCL-dev/HMCL/blob/main/HMCLCore/src/main/java/org/jackhuang/hmcl/game/DefaultGameRepository.java#L147
  let natives_dir = version_dir.join(format!(
    "natives-{}-{}",
    tauri_plugin_os::platform(),
    tauri_plugin_os::arch()
  ));
  if fs::create_dir_all(&natives_dir).is_err() {
    println!("create natives dir failed: {:?}", natives_dir);
  }
  let resolution_height;
  let resolution_width;
  let resolution = sjmcl_config.global_game_config.game_window.resolution;
  if resolution.fullscreen {
    resolution_height = resolution.height;
    resolution_width = resolution.width;
    println!("FULL SCREEN CURRENTLY NOT SUPPORT");
  } else {
    resolution_height = resolution.height;
    resolution_width = resolution.width;
  }
  let launch_feature = FeaturesInfo {
    is_demo_user: Some(false),
    has_custom_resolution: Some(true),
    has_quick_plays_support: Some(false), // TODO
    is_quick_play_multiplayer: Some(sjmcl_config.global_game_config.game_server.auto_join),
    is_quick_play_singleplayer: Some(false), // TODO
    is_quick_play_realms: Some(false),       // TODO
  };
  let launch_params = LaunchParams {
    assets_root: assets_dir.to_string_lossy().to_string(),
    assets_index_name: client_info.asset_index.id,
    game_directory: game_dir.to_string_lossy().to_string(),

    version_name: instance.version.clone(),
    version_type: client_info.type_,
    natives_directory: natives_dir.to_string_lossy().to_string(),
    launcher_name: format!("SJMCL {}", sjmcl_config.basic_info.launcher_version),
    launcher_version: sjmcl_config.basic_info.launcher_version,
    classpath: class_paths,

    auth_access_token: selected_user.access_token,
    auth_player_name: selected_user.name,
    user_type: "msa".to_string(), // TODO
    auth_uuid: selected_user.uuid.to_string(),
    auth_xuid: None, // TODO
    demo: false,
    clientid: None,
    resolution_height,
    resolution_width,
    quick_play_path: String::new(),
    quick_play_singleplayer: String::new(),
    quick_play_multiplayer: sjmcl_config.global_game_config.game_server.server_url,
    quick_play_realms: String::new(),
  };
  Ok((launch_params, launch_feature))
}
