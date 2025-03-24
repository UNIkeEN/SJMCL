// https://zh.minecraft.wiki/w/%E5%AE%A2%E6%88%B7%E7%AB%AF%E6%A0%B8%E5%BF%83%E6%96%87%E4%BB%B6

use super::file_validator::get_class_paths;
use crate::account::helpers::authlib_injector::common::get_authlib_injector_jar_path;
use crate::account::models::{AccountInfo, PlayerType};
use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::{
  helpers::client_json::{FeaturesInfo, JavaVersion, McClientInfo},
  models::misc::Instance,
};
use crate::launch::helpers::file_validator::extract_classifiers_to_natives_dir;
use crate::launch::models::{CommandContent, LaunchError};
use crate::launcher_config::models::{
  GameJava, JavaInfo, LauncherConfig, Performance, ProxyConfig, ProxyType,
};
use crate::resource::models::ResourceError;
use crate::storage::Storage;
use regex::Regex;
use serde::{self, Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Command, Stdio};
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
  pub fn to_hashmap(self) -> SJMCLResult<HashMap<String, String>> {
    let mut map: HashMap<String, String> = HashMap::new();
    map.insert("assets_root".to_string(), self.assets_root);
    map.insert("assets_index_name".to_string(), self.assets_index_name);
    map.insert("game_directory".to_string(), self.game_directory);
    map.insert("version_name".to_string(), self.version_name);
    map.insert("version_type".to_string(), self.version_type);
    map.insert("natives_directory".to_string(), self.natives_directory);
    map.insert("launcher_name".to_string(), self.launcher_name);
    map.insert("launcher_version".to_string(), self.launcher_version);
    map.insert(
      "classpath".to_string(),
      quote_java_classpaths(&self.classpath)?,
    );
    map.insert("auth_access_token".to_string(), self.auth_access_token);
    map.insert("auth_player_name".to_string(), self.auth_player_name);
    map.insert("user_type".to_string(), self.user_type);
    map.insert("auth_uuid".to_string(), self.auth_uuid);
    if let Some(ref clientid) = &self.clientid {
      map.insert("clientid".to_string(), clientid.to_owned());
    }
    if let Some(ref auth_xuid) = &self.auth_xuid {
      map.insert("auth_xuid".to_string(), auth_xuid.to_owned());
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
    map.insert("quickPlayPath".to_string(), self.quick_play_path);
    map.insert(
      "quickPlaySingleplayer".to_string(),
      self.quick_play_singleplayer,
    );
    map.insert(
      "quickPlayMultiplayer".to_string(),
      self.quick_play_multiplayer,
    );
    map.insert("quickPlayRealms".to_string(), self.quick_play_realms);
    Ok(map)
  }
}

fn choose_java_auto(java_list: &Vec<JavaInfo>, version_req: &JavaVersion) -> Option<JavaInfo> {
  let mut match_list = Vec::new();
  for java_info in java_list {
    if java_info.major_version == version_req.major_version {
      return Some(java_info.clone());
    } else if java_info.major_version > version_req.major_version {
      match_list.push(java_info);
    }
  }
  if match_list.is_empty() {
    return None;
  }
  match_list.sort_by(|a, b| a.major_version.cmp(&b.major_version));
  Some(match_list[0].clone())
}

fn choose_java(
  game_java: &GameJava,
  java_list: &Vec<JavaInfo>,
  version_req: &JavaVersion,
) -> SJMCLResult<JavaInfo> {
  if !game_java.auto {
    for java in java_list {
      if java.exec_path == game_java.exec_path {
        return Ok(java.clone());
      }
    }
  }
  match choose_java_auto(java_list, version_req) {
    Some(java) => Ok(java),
    None => Err(LaunchError::NoSuitableJavaError.into()),
  }
}

// https://github.com/HMCL-dev/HMCL/blob/d9e3816b8edf9e7275e4349d4fc67a5ef2e3c6cf/HMCLCore/src/main/java/org/jackhuang/hmcl/launch/DefaultLauncher.java#L69
pub async fn generate_launch_cmd(
  app: &AppHandle,
  instance_id: &usize,
  client_info: McClientInfo,
) -> SJMCLResult<CommandContent> {
  let mut cmd = Vec::new();
  let sjmcl_config = app.state::<Mutex<LauncherConfig>>().lock()?.clone();
  let java_list = app.state::<Mutex<Vec<JavaInfo>>>().lock()?.clone();
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
  let version_jar = version_dir
    .join(format!("{}.jar", game_name))
    .to_string_lossy()
    .to_string();
  class_paths.push(version_jar.clone());
  // https://github.com/HMCL-dev/HMCL/blob/main/HMCLCore/src/main/java/org/jackhuang/hmcl/game/DefaultGameRepository.java#L147
  let natives_dir = version_dir.join(format!(
    "natives-{}-{}",
    tauri_plugin_os::platform(),
    tauri_plugin_os::arch()
  ));
  extract_classifiers_to_natives_dir(&client_info, &libraries_dir, &natives_dir).await?;
  println!("{}:{}", std::file!(), std::line!());
  let resolution = sjmcl_config.global_game_config.game_window.resolution;
  let launch_feature = FeaturesInfo {
    is_demo_user: Some(false),
    has_custom_resolution: Some(true),
    has_quick_plays_support: Some(false), // TODO
    is_quick_play_multiplayer: Some(sjmcl_config.global_game_config.game_server.auto_join),
    is_quick_play_singleplayer: Some(false), // TODO
    is_quick_play_realms: Some(false),       // TODO
  };
  println!("{}:{}", std::file!(), std::line!());
  let launch_params = LaunchParams {
    assets_root: assets_dir.to_string_lossy().to_string(),
    assets_index_name: client_info.asset_index.id,
    game_directory: game_dir.to_string_lossy().to_string(),

    version_name: instance.version.clone(),
    version_type: format!("SJMCL {}", sjmcl_config.basic_info.launcher_version),
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
    resolution_height: resolution.height,
    resolution_width: resolution.width,
    quick_play_path: String::new(),
    quick_play_singleplayer: String::new(),
    quick_play_multiplayer: sjmcl_config.global_game_config.game_server.server_url,
    quick_play_realms: String::new(),
  };
  let java_info = choose_java(
    &sjmcl_config.global_game_config.game_java,
    &java_list,
    &client_info.java_version,
  )?;
  // collect extra config
  // 1. cmd nice
  // 2. java exec
  // 3. jvm params
  // login user
  if selected_user.player_type == PlayerType::ThirdParty {
    cmd.push(format!(
      "-javaagent:{}={}",
      get_authlib_injector_jar_path()?.to_string_lossy(),
      selected_user.auth_server_url
    )); // TODO
    cmd.push("-Dauthlibinjector.side=client".to_string());
    cmd.push(format!(
      "-Dauthlibinjector.yggdrasil.prefetched={}",
      "BASE64TODO"
    ));
  }
  println!("{}:{}", std::file!(), std::line!());
  cmd.extend(generate_proxy_cmd(&sjmcl_config.download.proxy)); // TODO: 分离下载proxy和多人游戏proxy
  cmd.extend(generate_jvm_memory_cmd(
    &sjmcl_config.global_game_config.performance,
  ));
  if sjmcl_config.global_game_config.advanced_options.enabled {
    cmd.extend(generate_jvm_metaspace_size_cmd(
      &sjmcl_config
        .global_game_config
        .advanced
        .jvm
        .java_permanent_generation_space,
      &java_info,
    ));
  }

  println!("{}:{}", std::file!(), std::line!());
  let map = launch_params.to_hashmap()?;
  if let Some(client_args) = &client_info.arguments {
    // specified jvm params
    let client_jvm_args = client_args.to_jvm_arguments(&launch_feature)?;
    println!("{}:{}", std::file!(), std::line!());
    cmd.extend(replace_arguments(client_jvm_args, &map));
  } else {
    // https://github.com/HMCL-dev/HMCL/blob/e8ff42c4b29d0b0a5a417c9d470390311c6d9a72/HMCLCore/src/main/java/org/jackhuang/hmcl/game/Arguments.java#L113
    let client_jvm_args = vec![
      "-Djava.library.path=${natives_directory}".to_string(),
      "-Dminecraft.launcher.brand=${launcher_name}".to_string(),
      "-Dminecraft.launcher.version=${launcher_version}".to_string(),
      "-cp".to_string(),
      "${classpath}".to_string(),
    ];
    cmd.extend(replace_arguments(client_jvm_args, &map));
  }

  // https://github.com/HMCL-dev/HMCL/blob/e8ff42c4b29d0b0a5a417c9d470390311c6d9a72/HMCLCore/src/main/java/org/jackhuang/hmcl/launch/DefaultLauncher.java#L147
  let file_encoding = "utf-8"; // TODO Here
  cmd.push(format!("-Dfile.encoding={}", file_encoding));
  if java_info.major_version < 19 {
    cmd.push(format!("-Dsun.stdout.encoding={}", file_encoding));
    cmd.push(format!("-Dsun.stderr.encoding={}", file_encoding));
  } else {
    cmd.push(format!("-Dstdout.encoding={}", file_encoding));
    cmd.push(format!("-Dstderr.encoding={}", file_encoding));
  }
  cmd.push("-Djava.rmi.server.useCodebaseOnly=true".to_string());
  cmd.push("-Dcom.sun.jndi.rmi.object.trustURLCodebase=false".to_string());
  cmd.push("-Dcom.sun.jndi.cosnaming.object.trustURLCodebase=false".to_string());
  // 4. main class
  println!("{}:{}", std::file!(), std::line!());
  cmd.push(client_info.main_class);

  println!("{}:{}", std::file!(), std::line!());
  // 5. game params
  if let Some(client_args) = &client_info.arguments {
    let client_game_args = client_args.to_game_arguments(&launch_feature)?;
    cmd.extend(replace_arguments(client_game_args, &map));
  } else if let Some(client_args_str) = client_info.minecraft_arguments {
    let client_game_args = client_args_str.split(' ').map(|s| s.to_string()).collect();
    cmd.extend(replace_arguments(client_game_args, &map));
  } else {
    return Err(ResourceError::InvalidClientInfo.into());
  }
  if resolution.fullscreen {
    cmd.push("--fullscreen".to_string());
  }

  Ok(CommandContent {
    exe: java_info.exec_path.clone(),
    args: cmd,
    nice: sjmcl_config
      .global_game_config
      .performance
      .process_priority
      .to_nice_value(),
  })
}

fn replace_arguments(args: Vec<String>, map: &HashMap<String, String>) -> Vec<String> {
  lazy_static::lazy_static!(
    static ref PARAM_REGEX: Regex = Regex::new(r"\$\{(\S+)\}").unwrap();
  );
  let mut cmd = Vec::new();
  for arg in args {
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
      cmd.push(replaced_arg);
    } else {
      cmd.push(arg);
    }
  }
  cmd
}

pub enum ExecuteType {
  TransferAndExit, // 1. 将控制权转移给 cmd，结束当前进程并隐藏窗口
  TransferAndHide, // 2. 隐藏窗口，但不立即退出进程
  NormalExecution, // 3. 正常执行，保留输出
}

pub async fn execute_cmd(
  cmd: CommandContent,
  execute_type: &ExecuteType,
) -> SJMCLResult<std::process::Output> {
  let mut cmd_base = Command::new(cmd.exe);
  let child = cmd_base.args(cmd.args).stdout(Stdio::piped()).spawn()?;
  let output = child.wait_with_output()?;
  Ok(output)
}

fn quote_java_classpaths(cp: &Vec<String>) -> SJMCLResult<String> {
  #[cfg(any(target_os = "linux", target_os = "macos"))]
  return Ok(cp.join(":"));
  #[cfg(any(target_os = "windows"))]
  return Ok(cp.join(";")); // TODO Here: check ';' in origin paths
}

// https://github.com/HMCL-dev/HMCL/blob/d9e3816b8edf9e7275e4349d4fc67a5ef2e3c6cf/HMCLCore/src/main/java/org/jackhuang/hmcl/launch/DefaultLauncher.java#L114
fn generate_proxy_cmd(p: &ProxyConfig) -> Vec<String> {
  if !p.enabled {
    return Vec::new();
  }
  match p.selected_type {
    ProxyType::Http => vec![
      format!("-Dhttp.proxyHost={}", p.host),
      format!("-Dhttp.proxyPort={}", p.port),
      format!("-Dhttps.proxyHost={}", p.host),
      format!("-Dhttps.proxyPort={}", p.port),
    ],
    ProxyType::Socks => vec![
      format!("-DsocksProxyHost={}", p.host),
      format!("-DsocksProxyPort={}", p.port),
    ],
  }
}

fn generate_jvm_memory_cmd(p: &Performance) -> Vec<String> {
  if p.auto_mem_allocation {
    return Vec::new();
  }
  vec!["-Xms".to_string(), p.min_mem_allocation.to_string()]
  // TODO: max memory
}

// https://github.com/HMCL-dev/HMCL/blob/d9e3816b8edf9e7275e4349d4fc67a5ef2e3c6cf/HMCLCore/src/main/java/org/jackhuang/hmcl/launch/DefaultLauncher.java#L139
fn generate_jvm_metaspace_size_cmd(meta_space: &u32, java_info: &JavaInfo) -> Vec<String> {
  if *meta_space == 0 {
    Vec::new()
  } else if java_info.major_version < 8 {
    vec![format!("-XX:PermSize={}M", meta_space)]
  } else {
    vec![format!("-XX:MetaspaceSize={}M", meta_space)]
  }
}
