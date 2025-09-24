use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::models::world::level::{Level, LevelData};
use quartz_nbt::io::Flavor;
use quartz_nbt::serde::deserialize;
use std::path::PathBuf;

pub async fn load_level_data_from_path(path: &PathBuf) -> SJMCLResult<LevelData> {
  let nbt_bytes = tokio::fs::read(path).await?;
  let (level, _) = deserialize::<Level>(&nbt_bytes, Flavor::GzCompressed)?;
  Ok(level.data)
}

pub fn level_data_to_world_info(data: &LevelData) -> SJMCLResult<(i64, String, String)> {
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
  Ok((
    last_played,
    DIFFICULTY_STR[difficulty as usize].to_string(),
    GAMEMODE_STR[gametype as usize].to_string(),
  ))
}
