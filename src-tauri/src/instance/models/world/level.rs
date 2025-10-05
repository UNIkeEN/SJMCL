use crate::instance::models::world::player::PlayerData;
use serde::{self, Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct Level {
  #[serde(rename = "Data")]
  pub data: LevelData,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase", default)]
pub struct LevelData {
  #[serde(rename = "allowCommands")]
  pub allow_commands: Option<u8>,
  pub border_center_x: Option<f64>,
  pub border_center_z: Option<f64>,
  pub border_damage_per_block: Option<f64>,
  pub border_safe_zone: Option<f64>,
  pub border_size: Option<f64>,
  pub border_size_lerp_target: Option<f64>,
  pub border_size_lerp_time: Option<i64>,

  pub border_warning_blocks: Option<f64>,
  pub border_warning_time: Option<f64>,
  pub clear_weather_time: i64,
  pub data_version: i64,
  pub daytime: i64,
  pub difficulty: Option<u8>,
  pub difficulty_locked: Option<bool>,
  pub game_rules: HashMap<String, String>,

  // Note:
  // singleplayer worlds do not use this field to save
  // which game mode the player is currently in.
  pub game_type: i64,
  #[serde(rename = "hardcore")]
  pub hardcore: bool,
  #[serde(rename = "initialized")]
  pub initialized: bool,

  pub last_played: i64,
  pub level_name: String,
  pub map_features: Option<bool>,
  pub player: PlayerData,
  #[serde(rename = "rainTime")]
  pub rain_time: i64,
  #[serde(rename = "raining")]
  pub raining: bool,
  #[serde(rename = "RandomSeed")]
  pub seed: i64,
  pub spawn_x: i64,
  pub spawn_y: i64,
  pub spawn_z: i64,
  #[serde(rename = "thundering")]
  pub thundering: u8,
  #[serde(rename = "thunderTime")]
  pub thunder_time: i64,
  pub time: i64,
  #[serde(rename = "version")]
  pub version: i64,
  #[serde(rename = "Version")]
  pub version_struct: Version,
  pub wandering_trader_spawn_chance: i64,
  pub wandering_trader_spawn_delay: i64,
  pub was_modded: u8,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
pub struct Version {
  pub id: i32,
  pub name: String,
  pub series: Option<String>,
  pub snapshot: bool,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct EnderItemsEntry {
  pub id: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GameRules {
  #[serde(rename = "doMobLoot")]
  pub mob_loot: String,
  #[serde(rename = "doTileDrops")]
  pub tile_drops: String,
  #[serde(rename = "doFireTick")]
  pub fire_tick: String,
  pub mob_griefing: String,
  pub command_block_output: String,
  #[serde(rename = "doMobSpawning")]
  pub mob_spawning: String,
  pub keep_inventory: String,
  pub show_death_messages: String,
  #[serde(rename = "doEntityDrops")]
  pub entity_drops: String,
  pub natural_regeneration: String,
  pub log_admin_commands: String,
  #[serde(rename = "doDaylightCycle")]
  pub daylight_cycle: String,
  pub send_command_feedback: String,
  pub random_tick_speed: String,
  pub reduced_debug_info: String,
}
