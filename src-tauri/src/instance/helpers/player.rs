// https://minecraft.wiki/w/Java_Edition_level_format#level.dat_format

use crate::error::{SJMCLError, SJMCLResult};
use quartz_nbt::{io::Flavor, serde::deserialize, NbtCompound};
use serde::{self, Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct PlayerData {
  #[serde(rename = "PersistentId")]
  pub persistant_id: Option<i32>,
  #[serde(rename = "playerGameType")]
  pub game_type: i32,
  pub abilities: PlayerAbilityData,
  #[serde(rename = "Score")]
  pub score: Option<i32>,

  #[serde(rename = "Dimension")]
  pub dimension: i32,
  #[serde(rename = "OnGround")]
  pub on_ground: u8,
  #[serde(rename = "FallDistance")]
  pub fall_distance: f32,
  #[serde(rename = "Motion")]
  pub motion: Vec<f64>, // [f64; 3]
  #[serde(rename = "Pos")]
  pub position: Vec<f64>, // [f64; 3]
  #[serde(rename = "Rotation")]
  pub rotation: Vec<f32>, // [f32; 2]

  #[serde(rename = "SpawnX")]
  pub spawn_x: i32,
  #[serde(rename = "SpawnY")]
  pub spawn_y: i32,
  #[serde(rename = "SpawnZ")]
  pub spawn_z: i32,
  #[serde(rename = "SpawnForced")]
  pub spawn_forced: Option<u8>,

  #[serde(rename = "PortalCooldown")]
  pub portal_cooldown: Option<i32>,
  #[serde(rename = "Invulnerable")]
  pub invulnerable: Option<u8>,

  #[serde(rename = "AttackTime")]
  pub attack_time: Option<i16>,
  #[serde(rename = "HurtTime")]
  pub hurt_time: i16,
  #[serde(rename = "HurtByTimestamp")]
  pub hurt_by: Option<i32>,
  #[serde(rename = "DeathTime")]
  pub death_time: i16,
  #[serde(rename = "Sleeping")]
  pub sleeping: u8,
  #[serde(rename = "SleepTimer")]
  pub sleep_timer: i16,

  #[serde(rename = "Health")]
  pub health: i16,
  #[serde(rename = "HealF")]
  pub heal: Option<f32>,
  #[serde(rename = "foodLevel")]
  pub food_level: i32,
  #[serde(rename = "foodTickTimer")]
  pub food_tick_timer: i32,
  #[serde(rename = "foodSaturationLevel")]
  pub food_saturation_level: f32,
  #[serde(rename = "foodExhaustionLevel")]
  pub food_exhaustion_level: f32,

  #[serde(rename = "Fire")]
  pub fire: i16,
  #[serde(rename = "Air")]
  pub air: i16,

  #[serde(rename = "XpP")]
  pub xp_p: f32,
  #[serde(rename = "XpLevel")]
  pub xp_level: i32,
  #[serde(rename = "XpTotal")]
  pub xp_total: i32,
  #[serde(rename = "XpSeed")]
  pub xp_seed: Option<i32>,

  #[serde(rename = "Inventory")]
  pub inventory: Vec<InventoryEntry>,
  #[serde(rename = "EnderItems")]
  pub ender_items: Vec<u8>,

  #[serde(rename = "SelectedItemSlot")]
  pub selected_item_slot: Option<i32>,
  #[serde(rename = "SelectedItem")]
  pub selected_item: Option<InventoryEntry>,
  #[serde(rename = "UUIDLeast")]
  pub uuid_least: Option<i64>,
  #[serde(rename = "UUIDMost")]
  pub uuid_most: Option<i64>,
  #[serde(rename = "AbsorptionAmount")]
  pub absorbtion_amount: Option<f32>,
  #[serde(rename = "Attributes")]
  pub attributes: Option<Vec<AttributeEntry>>,
  #[serde(rename = "ActiveEffects")]
  pub active_effects: Option<Vec<ActiveEffect>>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct PlayerAbilityData {
  pub invulnerable: u8,
  pub instabuild: u8,
  pub flying: u8,
  #[serde(rename = "flySpeed")]
  pub fly_speed: f32,
  #[serde(rename = "walkSpeed")]
  pub walk_speed: f32,
  #[serde(rename = "mayBuild")]
  pub may_build: u8,
  #[serde(rename = "mayfly")]
  pub may_fly: u8,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AttributeEntry {
  #[serde(rename = "Name")]
  pub name: String,
  #[serde(rename = "Base")]
  pub base: f64,
  #[serde(rename = "Modifiers")]
  pub modifiers: Option<Vec<AttributeModifier>>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct InventoryEntry {
  pub id: String,
  #[serde(rename = "Slot")]
  pub slot: Option<u8>,
  #[serde(rename = "Count")]
  pub count: u8,
  #[serde(rename = "Damage")]
  pub damage: i16,
  #[serde(rename = "tag")]
  pub info: Option<InventoryEntryInfo>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AttributeModifier {
  #[serde(rename = "Name")]
  pub name: String,
  #[serde(rename = "Amount")]
  pub amount: f64,
  #[serde(rename = "Operation")]
  pub operation: i32,
  #[serde(rename = "UUIDLeast")]
  pub uuid_least: i64,
  #[serde(rename = "UUIDMost")]
  pub uuid_most: i64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ActiveEffect {
  #[serde(rename = "Id")]
  pub id: u8,
  #[serde(rename = "Duration")]
  pub base: i32,
  #[serde(rename = "Ambient")]
  pub ambient: u8,
  #[serde(rename = "Amplifier")]
  pub amplifier: u8,
  #[serde(rename = "ShowParticles")]
  pub show_particles: u8,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct InventoryEntryInfo {
  pub display: Option<InventoryEntryDisplay>,
  #[serde(rename = "RepairCost")]
  pub repair_cost: Option<i32>,
  #[serde(rename = "ench")]
  pub enchantments: Vec<Enchantment>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct InventoryEntryDisplay {
  #[serde(rename = "Name")]
  pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Enchantment {
  pub id: i16,
  #[serde(rename = "lvl")]
  pub level: i16,
}

pub fn bytes_to_player_data(bytes: &[u8], flavor: Flavor) -> SJMCLResult<PlayerData> {
  match deserialize::<PlayerData>(bytes, flavor) {
    Ok((player_data, _)) => Ok(player_data), // 忽略返回的 String
    Err(e) => Err(SJMCLError::from(e)),
  }
}
