use crate::{
  error::{SJMCLError, SJMCLResult},
  instance::models::world::level::{Level, LevelData},
};
use quartz_nbt::{io::Flavor, serde::deserialize, NbtCompound};

pub fn bytes_to_level_data(bytes: &[u8], flavor: Flavor) -> SJMCLResult<LevelData> {
  match deserialize::<Level>(bytes, flavor) {
    Ok((level, _)) => Ok(level.data), // 忽略返回的 String
    Err(e) => Err(SJMCLError::from(e)),
  }
}

pub fn nbt_to_world_info(nbt: &NbtCompound) -> SJMCLResult<(i64, String, String)> {
  // return (last_played, difficulty, gamemode)
  match nbt.get::<_, &NbtCompound>("Data") {
    Ok(data) => {
      let last_played: i64;
      if let Ok(val) = data.get::<_, &i64>("LastPlayed") {
        last_played = *val / 1000;
      } else {
        last_played = 0;
      }
      let mut difficulty: u8;
      if let Ok(val) = data.get::<_, &u8>("Difficulty") {
        difficulty = *val;
      } else {
        difficulty = 2;
      }
      if let Ok(val) = data.get::<_, &u8>("hardcore") {
        if *val != 0 {
          difficulty = 4;
        }
      }
      const DIFFICULTY_STR: [&str; 5] = ["peaceful", "easy", "normal", "hard", "hardcore"];
      if difficulty >= DIFFICULTY_STR.len() as u8 {
        return Err(SJMCLError(format!(
          "difficulty = {}, which is greater than 5",
          difficulty
        )));
      }
      let gametype: i32;
      if let Ok(val) = data.get::<_, &i32>("GameType") {
        gametype = *val;
      } else {
        gametype = 0;
      }
      const GAMEMODE_STR: [&str; 4] = ["survival", "creative", "adventure", "spectator"];
      if gametype < 0 || gametype >= GAMEMODE_STR.len() as i32 {
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
    Err(e) => Err(SJMCLError::from(e)),
  }
}
