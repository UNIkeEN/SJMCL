// https://minecraft.wiki/w/Java_Edition_level_format#level.dat_format

use super::player::PlayerData;
use crate::error::{SJMCLError, SJMCLResult};
use quartz_nbt::{io::Flavor, serde::deserialize, NbtCompound};
use serde::{self, Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct Level {
  #[serde(rename = "Data")]
  pub data: LevelData,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct LevelData {
  #[serde(rename = "allowCommands")]
  pub allow_commands: Option<u8>,
  #[serde(rename = "BorderCenterX", default = "default_border_center")]
  pub border_center_x: f64,
  #[serde(rename = "BorderCenterZ", default = "default_border_center")]
  pub border_center_z: f64,
  #[serde(
    rename = "BorderDamagePerBlock",
    default = "default_border_damage_per_block"
  )]
  pub border_damage_per_block: f64,
  #[serde(rename = "BorderSafeZone", default = "default_border_safe_zone")]
  pub border_safe_zone: f64,
  #[serde(rename = "BorderSize", default = "default_border_size")]
  pub border_size: f64,
  #[serde(
    rename = "BorderSizeLerpTarget",
    default = "default_border_size_lerp_target"
  )]
  pub border_size_lerp_target: f64,
  #[serde(
    rename = "BorderSizeLerpTime",
    default = "default_border_size_lerp_time"
  )]
  pub border_size_lerp_time: i64,
  #[serde(
    rename = "BorderWarningBlocks",
    default = "default_border_warning_blocks"
  )]
  pub border_warning_blocks: f64,
  #[serde(rename = "BorderWarningTime", default = "default_border_warning_time")]
  pub border_warning_time: f64,
  #[serde(rename = "clearWeatherTime")]
  pub clear_weather_time: i32,
  #[serde(rename = "DataVersion")]
  pub data_version: i32,
  #[serde(rename = "DayTime")]
  pub daytime: i64,
  #[serde(rename = "Difficulty", default = "default_difficulty")]
  pub difficulty: u8,
  #[serde(rename = "DifficultyLocked", default = "default_difficulty_locked")]
  pub difficulty_locked: u8,

  #[serde(rename = "GameRules")]
  pub game_rules: HashMap<String, u8>,

  // Note:
  // singleplayer worlds do not use this field to save
  // which game mode the player is currently in.
  #[serde(rename = "GameType")]
  pub game_type: i32,

  pub hardcore: u8,
  pub initialized: u8,

  #[serde(rename = "LastPlayed")]
  pub last_played: i64,
  #[serde(rename = "LevelName")]
  pub level_name: String,

  #[serde(rename = "MapFeatures", default = "default_map_features")]
  pub map_features: u8,

  #[serde(rename = "Player")]
  pub player: PlayerData,
  #[serde(rename = "rainTime")]
  pub rain_time: i32,
  pub raining: u8,

  #[serde(rename = "RandomSeed")]
  pub seed: i64,

  #[serde(rename = "SpawnX")]
  pub spawn_x: i32,
  #[serde(rename = "SpawnY")]
  pub spawn_y: i32,
  #[serde(rename = "SpawnZ")]
  pub spawn_z: i32,

  pub thundering: u8,
  #[serde(rename = "thunderTime")]
  pub thunder_time: i32,
  #[serde(rename = "Time")]
  pub time: i64,
  pub version: i32,
  #[serde(rename = "Version")]
  pub version_struct: Version,
  #[serde(rename = "WanderingTraderSpawnChance")]
  pub wandering_trader_spawn_chance: i32,
  #[serde(rename = "WanderingTraderSpawnDelay")]
  pub wandering_trader_spawn_delay: i32,
  #[serde(rename = "WasModded")]
  pub was_modded: u8,
}

fn default_border_center() -> f64 {
  0.0
}
fn default_border_damage_per_block() -> f64 {
  0.2
}
fn default_border_size() -> f64 {
  60000000.
}
fn default_border_safe_zone() -> f64 {
  5.
}
fn default_border_size_lerp_target() -> f64 {
  60000000.
}
fn default_border_size_lerp_time() -> i64 {
  0
}
fn default_border_warning_blocks() -> f64 {
  5.
}
fn default_border_warning_time() -> f64 {
  15.
}
fn default_difficulty() -> u8 {
  2
}
fn default_difficulty_locked() -> u8 {
  0
}
fn default_map_features() -> u8 {
  1
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
pub struct Version {
  pub id: i32,
  pub name: String,
  pub series: String,
  pub snapshot: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct EnderItemsEntry {
  pub id: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct GameRules {
  #[serde(rename = "doMobLoot")]
  pub mob_loot: String,
  #[serde(rename = "doTileDrops")]
  pub tile_drops: String,
  #[serde(rename = "doFireTick")]
  pub fire_tick: String,
  #[serde(rename = "mobGriefing")]
  pub mob_griefing: String,
  #[serde(rename = "commandBlockOutput")]
  pub command_block_output: String,
  #[serde(rename = "doMobSpawning")]
  pub mob_spawning: String,
  #[serde(rename = "keepInventory")]
  pub keep_inventory: String,
  #[serde(rename = "showDeathMessages")]
  pub show_death_messages: String,
  #[serde(rename = "doEntityDrops")]
  pub entity_drops: String,
  #[serde(rename = "naturalRegeneration")]
  pub natural_regeneration: String,
  #[serde(rename = "logAdminCommands")]
  pub log_admin_commands: String,
  #[serde(rename = "doDaylightCycle")]
  pub daylight_cycle: String,
  #[serde(rename = "sendCommandFeedback")]
  pub send_command_feedback: String,
  #[serde(rename = "randomTickSpeed")]
  pub random_tick_speed: String,
  #[serde(rename = "reducedDebugInfo")]
  pub reduced_debug_info: String,
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

pub fn bytes_to_level_data(bytes: &[u8], flavor: Flavor) -> SJMCLResult<LevelData> {
  match deserialize::<Level>(bytes, flavor) {
    Ok((level, _)) => Ok(level.data), // 忽略返回的 String
    Err(e) => Err(SJMCLError::from(e)),
  }
}
