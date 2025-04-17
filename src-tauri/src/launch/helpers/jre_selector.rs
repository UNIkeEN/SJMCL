use crate::error::SJMCLResult;
use crate::instance::helpers::client_json::JavaVersion;
use crate::launch::models::LaunchError;
use crate::launcher_config::models::{GameJava, JavaInfo};
use std::cmp::Ordering;

pub fn select_java_runtime(
  game_java: &GameJava,
  java_list: &[JavaInfo],
  version_req: &JavaVersion,
  // TODO: pass client and mod loader info to calculate version with more rules, instead of passing require version
  // ref: https://github.com/Hex-Dragon/PCL2/blob/16e09c792ce8c13435fc6827e6da54170aaa3bc0/Plain%20Craft%20Launcher%202/Modules/Minecraft/ModLaunch.vb#L1130
) -> SJMCLResult<JavaInfo> {
  if !game_java.auto {
    return java_list
      .iter()
      .find(|j| j.exec_path == game_java.exec_path)
      .cloned()
      .ok_or_else(|| LaunchError::NoSuitableJava.into());
  }

  let mut higher_candidates = Vec::new();
  for java in java_list {
    match java.major_version.cmp(&version_req.major_version) {
      Ordering::Equal => return Ok(java.clone()),
      Ordering::Greater => higher_candidates.push(java.clone()),
      _ => {}
    }
  }

  if higher_candidates.is_empty() {
    Err(LaunchError::NoSuitableJava.into())
  } else {
    higher_candidates.sort_by_key(|j| j.major_version);
    Ok(higher_candidates[0].clone())
  }
}
