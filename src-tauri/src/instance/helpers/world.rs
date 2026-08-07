use quartz_nbt::io::Flavor;
use quartz_nbt::serde::deserialize;
use serde::Deserialize;
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::path::{Path, PathBuf};
use uuid::Uuid;

use crate::instance::models::world::base::WorldInfo;
use crate::instance::models::world::level::{Level, LevelData, WeatherData, WorldBorderData};
use crate::instance::models::world::player::PlayerData;

#[derive(Debug, Deserialize)]
struct WorldGenSettingsFile {
  data: WorldGenSettings,
}

#[derive(Debug, Deserialize, Default)]
struct WorldGenSettings {
  seed: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct WorldBorderFile {
  data: WorldBorderData,
}

#[derive(Debug, Deserialize)]
struct WeatherFile {
  data: WeatherData,
}

const DIFFICULTY_STR: [&str; 5] = ["peaceful", "easy", "normal", "hard", "hardcore"];

pub async fn load_world_info_from_dir(
  path: &Path,
  has_difficulty_support: bool,
) -> SJMCLResult<WorldInfo> {
  let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

  let icon_path = path.join("icon.png");
  let nbt_path = path.join("level.dat");

  let level_data = load_level_data_from_nbt(&nbt_path).await?;
  let (last_played, difficulty, gamemode) = level_data_to_world_info(&level_data)?;

  Ok(WorldInfo {
    name: name.to_string(),
    last_played_at: last_played,
    difficulty: has_difficulty_support.then(|| difficulty.to_string()),
    gamemode: gamemode.to_string(),
    icon_src: icon_path,
    dir_path: path.to_path_buf(),
  })
}

async fn load_nbt<T>(path: &Path) -> SJMCLResult<T>
where
  T: serde::de::DeserializeOwned,
{
  let nbt_bytes = tokio::fs::read(path).await?;
  let (value, _) = deserialize::<T>(&nbt_bytes, Flavor::GzCompressed)?;
  Ok(value)
}

pub async fn load_level_data_from_nbt(path: &Path) -> SJMCLResult<LevelData> {
  Ok(load_nbt::<Level>(path).await?.data)
}

pub async fn load_world_data_from_dir(path: &Path) -> SJMCLResult<LevelData> {
  let mut data = load_level_data_from_nbt(&path.join("level.dat")).await?;

  if data.player.is_none() {
    if let Some(uuid_parts) = &data.singleplayer_uuid {
      if let Some(player_path) = player_data_path(path, uuid_parts) {
        data.player = load_nbt::<PlayerData>(&player_path).await.ok();
      }
    }
  }

  data.world_border = load_nbt::<WorldBorderFile>(
    &path.join("dimensions/minecraft/overworld/data/minecraft/world_border.dat"),
  )
  .await
  .ok()
  .map(|f| f.data);

  data.weather = load_nbt::<WeatherFile>(&path.join("data/minecraft/weather.dat"))
    .await
    .ok()
    .map(|f| f.data);

  data.seed = data.seed.or(
    load_nbt::<WorldGenSettingsFile>(&path.join("data/minecraft/world_gen_settings.dat"))
      .await
      .ok()
      .and_then(|f| f.data.seed),
  );

  Ok(data)
}

fn player_data_path(path: &Path, uuid_parts: &[i32]) -> Option<PathBuf> {
  if uuid_parts.len() != 4 {
    return None;
  }
  let most = ((uuid_parts[0] as u32 as u64) << 32) | (uuid_parts[1] as u32 as u64);
  let least = ((uuid_parts[2] as u32 as u64) << 32) | (uuid_parts[3] as u32 as u64);
  Some(
    path
      .join("players/data")
      .join(format!("{}.dat", Uuid::from_u64_pair(most, least))),
  )
}

fn level_data_to_world_info(data: &LevelData) -> SJMCLResult<(i64, String, String)> {
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
  if difficulty >= DIFFICULTY_STR.len() as u8 {
    return Err(SJMCLError(format!(
      "difficulty = {}, which is greater than 4",
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
