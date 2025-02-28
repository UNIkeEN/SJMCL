// https://zh.minecraft.wiki/w/%E5%AE%A2%E6%88%B7%E7%AB%AF%E6%A0%B8%E5%BF%83%E6%96%87%E4%BB%B6

use std::collections::HashMap;

use regex::Regex;
use serde::{self, Deserialize, Serialize};

use crate::{
  error::{SJMCLError, SJMCLResult},
  instance::helpers::client::LaunchArgumentTemplate,
};

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
  pub clientid: String,
  pub auth_xuid: String,

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
  pub resolution_height: i64,
  pub resolution_width: i64,

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
    let mut map = HashMap::new();
    map.insert("assets_root".to_string(), self.assets_root.clone());
    map.insert(
      "assets_index_name".to_string(),
      self.assets_index_name.clone(),
    );
    map.insert("game_directory".to_string(), self.game_directory.clone());
    map.insert("version_name".to_string(), self.version_name.clone());
    map.insert("version_type".to_string(), self.version_type.clone());
    map.insert(
      "natives_directory".to_string(),
      self.natives_directory.clone(),
    );
    map.insert("launcher_name".to_string(), self.launcher_name.clone());
    map.insert(
      "launcher_version".to_string(),
      self.launcher_version.clone(),
    );
    map.insert("classpath".to_string(), self.classpath.join(","));
    map.insert(
      "auth_access_token".to_string(),
      self.auth_access_token.clone(),
    );
    map.insert(
      "auth_player_name".to_string(),
      self.auth_player_name.clone(),
    );
    map.insert("user_type".to_string(), self.user_type.clone());
    map.insert("auth_uuid".to_string(), self.auth_uuid.clone());
    map.insert("clientid".to_string(), self.clientid.clone());
    map.insert("auth_xuid".to_string(), self.auth_xuid.clone());
    map.insert("demo".to_string(), self.demo.to_string());
    map.insert(
      "resolution_height".to_string(),
      self.resolution_height.to_string(),
    );
    map.insert(
      "resolution_width".to_string(),
      self.resolution_width.to_string(),
    );
    map.insert("quickPlayPath".to_string(), self.quick_play_path.clone());
    map.insert(
      "quickPlaySingleplayer".to_string(),
      self.quick_play_singleplayer.clone(),
    );
    map.insert(
      "quickPlayMultiplayer".to_string(),
      self.quick_play_multiplayer.clone(),
    );
    map.insert(
      "quickPlayRealms".to_string(),
      self.quick_play_realms.clone(),
    );
    map
  }
}

pub fn generate_launch_params(
  params: &LaunchParams,
  argument_template: &LaunchArgumentTemplate,
) -> SJMCLResult<Vec<String>> {
  lazy_static::lazy_static!(
      static ref PARAM_REGEX: Regex = Regex::new(r"\$\{(\S+)\}").unwrap();
  );
  let map = params.to_hashmap();
  let mut result = Vec::new();
  for arg in argument_template.to_arguments()? {
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
      result.pop();
    }
  }

  Ok(result)
}
