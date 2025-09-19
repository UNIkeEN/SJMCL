use crate::error::SJMCLResult;
use crate::instance::helpers::game_version::compare_game_versions;
use crate::instance::models::misc::Instance;
use crate::launch::models::LaunchError;
use crate::launcher_config::models::{GameJava, JavaInfo};
use std::cmp::Ordering;
use tauri::AppHandle;

pub async fn select_java_runtime(
  app: &AppHandle,
  game_java: &GameJava,
  java_list: &[JavaInfo],
  instance: &Instance,
  client_json_req: i32,
  // TODO: pass client and mod loader info to calculate version with more rules, instead of passing require version
  // ref: https://github.com/Hex-Dragon/PCL2/blob/16e09c792ce8c13435fc6827e6da54170aaa3bc0/Plain%20Craft%20Launcher%202/Modules/Minecraft/ModLaunch.vb#L1130
) -> SJMCLResult<JavaInfo> {
  if !game_java.auto {
    return java_list
      .iter()
      .find(|j| j.exec_path == game_java.exec_path)
      .cloned()
      .ok_or_else(|| LaunchError::SelectedJavaUnavailable.into());
  }

  let mut min_version_req = get_minimum_java_version_by_game(app, instance).await;

  if client_json_req > min_version_req {
    min_version_req = client_json_req;
  }

  let mut suitable_candidates = Vec::new();
  for java in java_list {
    match java.major_version.cmp(&min_version_req) {
      Ordering::Equal => return Ok(java.clone()),
      Ordering::Greater => suitable_candidates.push(java.clone()),
      _ => {}
    }
  }

  if suitable_candidates.is_empty() {
    Err(LaunchError::NoSuitableJava.into())
  } else {
    suitable_candidates.sort_by_key(|j| j.major_version);
    Ok(suitable_candidates[0].clone())
  }
}

/// Get minimum java version requirement by game client version
/// ref: https://zh.minecraft.wiki/w/Java%E7%89%88?variant=zh-cn#%E8%BD%AF%E4%BB%B6%E9%9C%80%E6%B1%82
async fn get_minimum_java_version_by_game(app: &AppHandle, instance: &Instance) -> i32 {
  // only allow fallback remote fetch here in the launch process, as Java selection and command generation are used sequentially.
  // ref: https://github.com/UNIkeEN/SJMCL/pull/799
  // 1.20.5(24w14a)+
  if compare_game_versions(app, &instance.version, "24w14a", true).await >= Ordering::Equal {
    return 21;
  }
  // 1.18(1.18-pre2)+
  if compare_game_versions(app, &instance.version, "1.18-pre2", false).await >= Ordering::Equal {
    return 17;
  }
  // 1.17(21w19a)+
  if compare_game_versions(app, &instance.version, "21w19a", false).await >= Ordering::Equal {
    return 16;
  }
  // 1.12(17w13a)+
  if compare_game_versions(app, &instance.version, "17w13a", false).await >= Ordering::Equal {
    return 8;
  }
  0
}
