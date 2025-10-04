use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::helpers::game_version::compare_game_versions;
use crate::instance::models::misc::Instance;
use crate::instance::models::world::level::{Level, LevelData};
use quartz_nbt::io::Flavor;
use quartz_nbt::serde::deserialize;
use std::path::PathBuf;
use tauri::AppHandle;

pub async fn load_level_data_from_path(path: &PathBuf) -> SJMCLResult<LevelData> {
  let nbt_bytes = tokio::fs::read(path).await?;
  let (level, _) = deserialize::<Level>(&nbt_bytes, Flavor::GzCompressed)?;
  Ok(level.data)
}

pub async fn level_data_to_world_info(
  app: &AppHandle,
  game_version: &String,
  data: &LevelData,
) -> SJMCLResult<(i64, String, String)> {
  // return (last_played, difficulty, gamemode)
  let last_played = data.last_played / 1000;
  let mut difficulty: u8;
  if let Some(ref val) = data.difficulty {
    difficulty = *val;
  } else {
    difficulty = 2;
  }
  if data.hardcore {
    difficulty = 4;
  }
  const DIFFICULTY_STR: [&str; 5] = ["peaceful", "easy", "normal", "hard", "hardcore"];
  if difficulty >= DIFFICULTY_STR.len() as u8 {
    return Err(SJMCLError(format!(
      "difficulty = {}, which is greater than 5",
      difficulty
    )));
  }
  let gametype = data.game_type;
  const GAMEMODE_STR: [&str; 4] = ["survival", "creative", "adventure", "spectator"];
  if gametype < 0 || gametype >= GAMEMODE_STR.len() as i64 {
    return Err(SJMCLError(format!(
      "gametype = {}, which < 0 or >= 4",
      gametype
    )));
  }

  let difficulty_str: &str;
  if compare_game_versions(app, game_version, "14w02a", false)
    .await
    .is_ge()
  {
    difficulty_str = DIFFICULTY_STR[difficulty as usize];
  } else {
    difficulty_str = "";
  }
  Ok((
    last_played,
    difficulty_str.to_string(),
    GAMEMODE_STR[gametype as usize].to_string(),
  ))
}
