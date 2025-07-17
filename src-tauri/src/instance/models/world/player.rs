// https://minecraft.wiki/w/Java_Edition_level_format#level.dat_format

use serde::{self, Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase", default)]
// serde::Value
pub struct PlayerData {
  pub data_version: i64,
  pub persistant_id: Option<i32>,
  #[serde(rename = "playerGameType")]
  pub game_type: i64,
  #[serde(rename = "abilities")]
  pub abilities: PlayerAbilityData,
  pub score: Option<i64>,
  pub dimension: Value, // good mojang
  pub on_ground: bool,
  pub fall_distance: f32,
  pub motion: Vec<f64>,   // [f64; 3]
  pub position: Vec<f64>, // [f64; 3]
  pub rotation: Vec<f32>, // [f32; 2]
  pub spawn_x: i32,
  pub spawn_y: i32,
  pub spawn_z: i32,
  pub spawn_forced: Option<u8>,
  pub portal_cooldown: Option<i32>,
  pub invulnerable: Option<u8>,
  pub attack_time: Option<i16>,
  pub hurt_time: i16,
  #[serde(rename = "HurtByTimestamp")]
  pub hurt_by: Option<i32>,
  // pub death_time: i16,
  pub sleeping: u8,
  #[serde(rename = "SleepTimer")]
  pub sleep_timer: i16,
  // pub health: i16,
  // #[serde(rename = "HealF")]
  // // pub heal: Option<f32>,
  pub food_level: i32,
  #[serde(rename = "foodTickTimer")]
  pub food_tick_timer: i32,
  #[serde(rename = "foodSaturationLevel")]
  pub food_saturation_level: f32,
  #[serde(rename = "foodExhaustionLevel")]
  pub food_exhaustion_level: f32,

  pub fire: i16,
  pub air: i16,

  pub xp_p: f32,
  pub xp_level: i32,
  pub xp_total: i32,
  pub xp_seed: Option<i32>,

  pub inventory: Vec<InventoryEntry>,
  pub ender_items: Vec<u8>,

  pub selected_item_slot: Option<i32>,
  pub selected_item: Option<InventoryEntry>,
  #[serde(rename = "UUIDLeast")]
  pub uuid_least: Option<i64>,
  #[serde(rename = "UUIDMost")]
  pub uuid_most: Option<i64>,
  pub absorbtion_amount: Option<f32>,
  pub attributes: Option<Vec<AttributeEntry>>,
  pub active_effects: Option<Vec<ActiveEffect>>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct PlayerAbilityData {
  pub invulnerable: u8,
  pub instabuild: u8,
  pub flying: u8,
  #[serde(rename = "flySpeed")]
  pub fly_speed: Option<f32>,
  #[serde(rename = "walkSpeed")]
  pub walk_speed: Option<f32>,
  #[serde(rename = "mayBuild")]
  pub may_build: Option<u8>,
  #[serde(rename = "mayfly")]
  pub may_fly: Option<u8>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase", default)]
pub struct AttributeEntry {
  pub name: String,
  pub base: f64,
  pub modifiers: Option<Vec<AttributeModifier>>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase", default)]
pub struct InventoryEntry {
  pub id: String,
  pub slot: Option<u8>,
  pub count: u8,
  pub damage: i16,
  #[serde(rename = "tag")]
  pub info: Option<InventoryEntryInfo>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase", default)]
pub struct AttributeModifier {
  pub name: String,
  pub amount: f64,
  pub operation: i32,
  #[serde(rename = "UUIDLeast")]
  pub uuid_least: i64,
  #[serde(rename = "UUIDMost")]
  pub uuid_most: i64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase", default)]
pub struct ActiveEffect {
  pub id: u8,
  #[serde(rename = "Duration")]
  pub base: i32,
  pub ambient: u8,
  pub amplifier: u8,
  pub show_particles: u8,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase", default)]
pub struct InventoryEntryInfo {
  pub display: Option<InventoryEntryDisplay>,
  #[serde(rename = "RepairCost")]
  pub repair_cost: Option<i32>,
  #[serde(rename = "ench")]
  pub enchantments: Vec<Enchantment>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase", default)]
pub struct InventoryEntryDisplay {
  #[serde(rename = "Name")]
  pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase", default)]
pub struct Enchantment {
  pub id: i16,
  #[serde(rename = "lvl")]
  pub level: i16,
}
