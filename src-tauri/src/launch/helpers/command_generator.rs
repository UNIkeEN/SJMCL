use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::{
  helpers::client_json::FeaturesInfo,
  helpers::game_version::compare_game_versions,
  helpers::misc::get_instance_subdir_paths,
  models::misc::{InstanceError, InstanceSubdirType},
};
use crate::launch::helpers::misc::get_separator;
use crate::launch::{
  helpers::file_validator::get_nonnative_library_paths, helpers::misc::replace_arguments,
  models::LaunchingState,
};
use crate::launcher_config::helpers::memory::get_memory_info;
use crate::launcher_config::models::*;
use crate::{
  account::{
    helpers::authlib_injector::jar::get_jar_path as get_authlib_injector_jar_path,
    models::{AccountError, PlayerType},
  },
  launch::models::LaunchError,
};
use base64::{engine::general_purpose, Engine};
use serde::{self, Deserialize, Serialize};
use serde_json::Value;
use shlex::try_quote;
use std::borrow::Cow;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Default)]
pub struct LaunchArguments {
  // basic game params
  pub assets_root: String,
  pub assets_index_name: String,
  pub game_directory: String,
  pub version_name: String,
  pub version_type: String,
  pub natives_directory: String,
  pub launcher_name: String,
  pub launcher_version: String,

  // compatibility with HMCL
  pub primary_jar_name: String,

  // auth params
  pub auth_access_token: String,
  pub auth_player_name: String,
  pub user_type: String,
  pub auth_uuid: String,
  pub clientid: String,
  pub auth_xuid: String,
  pub user_properties: String,
  pub library_directory: String,
  pub classpath_separator: String,

  pub demo: bool,
  pub resolution_height: u32,
  pub resolution_width: u32,

  // quick play params
  #[serde(rename = "quickPlayPath")]
  pub quick_play_path: String,
  #[serde(rename = "quickPlaySingleplayer")]
  pub quick_play_singleplayer: String,
  #[serde(rename = "quickPlayMultiplayer")]
  pub quick_play_multiplayer: String,
  #[serde(rename = "quickPlayRealms")]
  pub quick_play_realms: String,
}

impl LaunchArguments {
  pub fn into_hashmap(self) -> SJMCLResult<HashMap<String, String>> {
    let value =
      serde_json::to_value(self).map_err(|e| SJMCLError(format!("Serialization error: {}", e)))?;
    let obj = value
      .as_object()
      .ok_or_else(|| SJMCLError("Failed to convert LaunchParams to HashMap".to_string()))?;

    let mut map = HashMap::new();

    for (k, v) in obj.iter() {
      match v {
        Value::Null => {} // skip null or none
        Value::String(s) => {
          map.insert(k.clone(), s.clone());
        }
        _ => {
          map.insert(k.clone(), v.to_string());
        }
      }
    }

    Ok(map)
  }
}

pub struct LaunchCommand {
  pub class_paths: Vec<String>, // may be too long for Windows, split and use env var
  pub args: Vec<String>,
}

pub async fn generate_launch_command(
  app: &AppHandle,
  quick_play_singleplayer: Option<String>,
  quick_play_multiplayer: Option<String>,
) -> SJMCLResult<LaunchCommand> {
  let launcher_config = { app.state::<Mutex<LauncherConfig>>().lock()?.clone() };
  let launching_queue = { app.state::<Mutex<Vec<LaunchingState>>>().lock()?.clone() };

  let LauncherConfig { basic_info, .. } = launcher_config;
  let launching = launching_queue
    .last()
    .ok_or(LaunchError::LaunchingStateNotFound)?
    .clone();
  let LaunchingState {
    selected_java,
    selected_instance,
    game_config,
    client_info,
    auth_server_meta,
    ..
  } = launching;
  let selected_player = launching
    .selected_player
    .clone()
    .ok_or(AccountError::NotFound)?;
  let client_jar_path = selected_instance
    .version_path
    .join(format!("{}.jar", selected_instance.name))
    .to_string_lossy()
    .to_string();

  let mut cmd = Vec::new();

  // macro_rules! gamecfg {
  //   ($path:literal, $ty:ty, $var:ident, $block:block) => {{
  //     let json = game_config.access($path).unwrap();
  //     let $var: $ty = serde_json::from_str(&json).unwrap();
  //     $block
  //   }};
  // }

  // -----------------------------------------
  // Part 1: Prepare Arguments
  // -----------------------------------------
  let related_dirs = get_instance_subdir_paths(
    app,
    &selected_instance,
    &[
      &InstanceSubdirType::Root,
      &InstanceSubdirType::Assets,
      &InstanceSubdirType::Libraries,
      &InstanceSubdirType::NativeLibraries,
    ],
  )
  .ok_or(InstanceError::InstanceNotFoundByID)?;

  let [root_dir, assets_dir, libraries_dir, natives_dir] = related_dirs.as_slice() else {
    return Err(InstanceError::InstanceNotFoundByID.into());
  };

  let mut class_paths: Vec<String> = get_nonnative_library_paths(&client_info, libraries_dir)?
    .into_iter()
    .collect::<HashSet<_>>()
    .into_iter()
    .map(|p| p.to_string_lossy().to_string())
    .collect();
  class_paths.push(client_jar_path.clone());

  let quickplay_server_url = match quick_play_multiplayer {
    Some(ref url) if !url.is_empty() => url.clone(),
    None if game_config.game_server.auto_join => game_config.game_server.server_url.clone(),
    _ => String::new(),
  };

  let arguments_value = LaunchArguments {
    assets_root: assets_dir.to_string_lossy().to_string(),
    assets_index_name: client_info.asset_index.id,
    game_directory: root_dir.to_string_lossy().to_string(),

    version_name: selected_instance.name.clone(),
    primary_jar_name: format!("{}.jar", selected_instance.name.clone()),
    version_type: if !game_config.game_window.custom_info.is_empty() {
      game_config.game_window.custom_info.clone()
    } else {
      format!("SJMCL {}", basic_info.launcher_version)
    },
    natives_directory: natives_dir.to_string_lossy().to_string(),
    launcher_name: format!("SJMCL {}", basic_info.launcher_version),
    launcher_version: basic_info.launcher_version,
    library_directory: libraries_dir.to_string_lossy().to_string(),
    classpath_separator: get_separator().to_string(),

    auth_access_token: selected_player.access_token.unwrap_or_default(),
    auth_player_name: selected_player.name,
    user_type: "msa".to_string(), // TODO
    auth_uuid: selected_player.uuid.to_string(),
    auth_xuid: "".to_string(), // TODO
    demo: false,
    user_properties: "{}".to_string(),
    clientid: "".to_string(),
    resolution_height: game_config.game_window.resolution.height,
    resolution_width: game_config.game_window.resolution.width,
    quick_play_path: String::new(),
    quick_play_singleplayer: quick_play_singleplayer.clone().unwrap_or_default(),
    quick_play_multiplayer: quickplay_server_url.clone(),
    quick_play_realms: String::new(),
  };

  // -----------------------------------------
  // Part 2: JVM
  // ref: https://github.com/HMCL-dev/HMCL/blob/c33ef5170b2cc726f01674fe6fca28035b1eef8b/HMCLCore/src/main/java/org/jackhuang/hmcl/launch/DefaultLauncher.java#L106
  // -----------------------------------------

  // set maximum memory allocation
  cmd.push(format!(
    "-Xmx{}m",
    if game_config.performance.auto_mem_allocation {
      let memory_info = get_memory_info();
      (memory_info.suggested_max_alloc / 1024 / 1024) as u32
    } else {
      game_config.performance.max_mem_allocation
    }
  ));

  let jvm = &game_config.advanced.jvm;
  {
    if jvm.java_permanent_generation_space != 0 {
      if selected_java.major_version < 8 {
        cmd.push(format!(
          "-XX:PermSize={}m",
          jvm.java_permanent_generation_space
        ));
      } else {
        cmd.push(format!(
          "-XX:MetaspaceSize={}m",
          jvm.java_permanent_generation_space
        ));
      }
    }

    if !jvm.args.is_empty() {
      cmd.extend(jvm.args.split_whitespace().map(|s| s.to_string()));
    }
  }

  let encoding = "UTF-8"; // TODO: get from system
  cmd.push(format!("-Dfile.encoding={}", encoding));
  if selected_java.major_version < 19 {
    cmd.push(format!("-Dsun.stdout.encoding={}", encoding));
    cmd.push(format!("-Dsun.stderr.encoding={}", encoding));
  } else {
    cmd.push(format!("-Dstdout.encoding={}", encoding));
    cmd.push(format!("-Dstderr.encoding={}", encoding));
  }

  cmd.push("-Djava.rmi.server.useCodebaseOnly=true".to_string());
  cmd.push("-Dcom.sun.jndi.rmi.object.trustURLCodebase=false".to_string());
  cmd.push("-Dcom.sun.jndi.cosnaming.object.trustURLCodebase=false".to_string());

  if !game_config.advanced.workaround.no_jvm_args {
    cmd.push(format!("-Dminecraft.client.jar={}", client_jar_path));

    #[cfg(target_os = "macos")]
    {
      cmd.push("-Xdock:name=Minecraft".to_string());
      // TODO: Xdock icon (HMCL DefaultLauncher.java#L183)
    }

    cmd.push("-Dfml.ignoreInvalidMinecraftCertificates=true".to_string());
    cmd.push("-Dfml.ignorePatchDiscrepancies=true".to_string());
  }

  // TODO: lwjgl non-ASCII path fix (HMCL DefaultLauncher.java#L236)

  // authlib-injector login
  if selected_player.player_type == PlayerType::ThirdParty {
    cmd.push(format!(
      "-javaagent:{}={}",
      get_authlib_injector_jar_path(app)?.to_string_lossy(),
      selected_player.auth_server_url.clone().unwrap_or_default()
    ));
    cmd.push("-Dauthlibinjector.side=client".to_string());
    cmd.push(format!(
      "-Dauthlibinjector.yggdrasil.prefetched={}",
      general_purpose::STANDARD.encode(&auth_server_meta)
    ));
  }

  // -----------------------------------------
  // Part 3: Replace JVM and game arguments
  // -----------------------------------------
  let map = arguments_value.into_hashmap()?;

  // some feature rules defined in client json, add to jvm/game arg templates
  let has_quickplay_single = quick_play_singleplayer
    .as_deref()
    .map(|s| s.trim())
    .is_some_and(|s| !s.is_empty());

  let launch_feature = FeaturesInfo {
    is_demo_user: Some(false),
    has_custom_resolution: Some(true),
    has_quick_plays_support: Some(true),
    is_quick_play_multiplayer: Some(
      !has_quickplay_single && !quickplay_server_url.trim().is_empty(),
    ),
    is_quick_play_singleplayer: Some(has_quickplay_single),
    is_quick_play_realms: Some(false), // unsupported
  };

  if let Some(client_args) = &client_info.arguments {
    // specified jvm params
    let mut client_jvm_args = client_args.to_jvm_arguments(&launch_feature)?;
    if let Some(classpath_pos) = client_jvm_args.iter().position(|s| s == "-cp") {
      // remove -cp and "${classpath}" and move them to the env to make command shorter
      client_jvm_args.remove(classpath_pos);
      client_jvm_args.remove(classpath_pos);
    }
    cmd.extend(replace_arguments(client_jvm_args, &map));
  } else {
    // ref: https://github.com/HMCL-dev/HMCL/blob/e8ff42c4b29d0b0a5a417c9d470390311c6d9a72/HMCLCore/src/main/java/org/jackhuang/hmcl/game/Arguments.java#L112
    let mut client_jvm_args = vec![];

    #[cfg(target_os = "windows")]
    {
      client_jvm_args.push(
        "-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump"
          .to_string(),
      );
      use regex::Regex;
      let re = Regex::new(r"^10\.").unwrap();
      if re.is_match(&basic_info.platform_version) {
        client_jvm_args.push("-Dos.name=Windows 10".to_string());
        client_jvm_args.push("-Dos.version=10.0".to_string());
      }
    }

    client_jvm_args.extend(vec![
      "-Djava.library.path=${natives_directory}".to_string(),
      "-Dminecraft.launcher.brand=${launcher_name}".to_string(),
      "-Dminecraft.launcher.version=${launcher_version}".to_string(),
    ]);
    cmd.extend(replace_arguments(client_jvm_args, &map));
  }

  // main class (after replace jvm args)
  cmd.push(client_info.main_class.clone());

  if let Some(client_args) = &client_info.arguments {
    let client_game_args = client_args.to_game_arguments(&launch_feature)?;
    cmd.extend(replace_arguments(client_game_args, &map));
  } else if let Some(client_args_str) = client_info.minecraft_arguments {
    let client_game_args = client_args_str.split(' ').map(|s| s.to_string()).collect();
    cmd.extend(replace_arguments(client_game_args, &map));
  } else {
    return Err(InstanceError::ClientJsonParseError.into());
  }

  // quick into server (for old version)
  if !quickplay_server_url.is_empty()
    && compare_game_versions(app, &selected_instance.version, "23w14a", false)
      .await
      .is_lt()
  {
    let (host, port) = quickplay_server_url
      .split_once(':')
      .map(|(h, p)| (h.to_string(), p.to_string()))
      .unwrap_or((quickplay_server_url.clone(), "25565".to_string()));

    cmd.extend(["--server".into(), host, "--port".into(), port]);
  }

  // fullscreen
  if game_config.game_window.resolution.fullscreen {
    cmd.push("--fullscreen".to_string());
  }

  Ok(LaunchCommand {
    class_paths,
    args: cmd,
  })
}

pub fn export_full_launch_command(
  class_paths: &[String],
  args: &[String],
  java_exec_str: &str,
) -> String {
  fn quote_or_raw(s: &str) -> Cow<str> {
    try_quote(s).unwrap_or(Cow::Borrowed(s))
  }

  let classpath_str = class_paths.join(get_separator());
  let java_exec = quote_or_raw(java_exec_str);
  let quoted_args = args.iter().map(|s| quote_or_raw(s)).collect::<Vec<_>>();

  let java_cmd = std::iter::once(java_exec)
    .chain(quoted_args)
    .collect::<Vec<_>>()
    .join(" ");

  #[cfg(target_os = "windows")]
  {
    format!("set CLASSPATH=\"{}\" && {}", classpath_str, java_cmd)
  }

  #[cfg(not(target_os = "windows"))]
  {
    format!("CLASSPATH=\"{}\" {}", classpath_str, java_cmd)
  }
}
