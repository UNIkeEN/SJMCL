export interface WorldInfo {
  name: string;
  lastPlayedAt: number;
  difficulty?: string;
  gamemode: string;
  iconSrc: string;
  dirPath: string;
}

// level and player data
export interface LevelData {
  allowCommands?: number;
  borderCenterX?: number;
  borderCenterZ?: number;
  borderDamagePerBlock?: number;
  borderSafeZone?: number;
  borderSize?: number;
  borderSizeLerpTarget?: number;
  borderSizeLerpTime?: number;
  borderWarningBlocks?: number;
  borderWarningTime?: number;
  clearWeatherTime: number;
  dataVersion: number;
  daytime: number;
  difficulty?: number;
  difficultyLocked?: boolean;
  gameRules: Record<string, string>;
  gameType: number;
  hardcore: boolean;
  initialized: boolean;
  lastPlayed: number;
  levelName: string;
  mapFeatures?: boolean;
  player: PlayerData;
  rainTime: number;
  raining: boolean;
  seed: number;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  thundering: number;
  thunderTime: number;
  time: number;
  version: number;
  versionStruct: Version;
  wanderingTraderSpawnChance: number;
  wanderingTraderSpawnDelay: number;
  wasModded: number;
}

export interface Version {
  id: number;
  name: string;
  series: string;
  snapshot: boolean;
}

export interface PlayerData {
  dataVersion: number;
  persistantId?: number;
  playerGameType: number;
  abilities: PlayerAbilityData;
  score?: number;
  dimension: string;
  onGround: boolean;
  fallDistance: number;
  motion: number[];
  position: number[];
  rotation: number[];
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  spawnForced?: number;
  portalCooldown?: number;
  invulnerable?: number;
  attackTime?: number;
  hurtTime: number;
  hurtBy?: number;
  sleeping: number;
  sleepTimer: number;
  foodLevel: number;
  foodTickTimer: number;
  foodSaturationLevel: number;
  foodExhaustionLevel: number;
  fire: number;
  air: number;
  xpP: number;
  xpLevel: number;
  xpTotal: number;
  xpSeed?: number;
  inventory: InventoryEntry[];
  enderItems: number[];
  selectedItemSlot?: number;
  selectedItem?: InventoryEntry;
  uuidLeast?: number;
  uuidMost?: number;
  absorptionAmount?: number;
  attributes?: AttributeEntry[];
  activeEffects?: ActiveEffect[];
}

export interface PlayerAbilityData {
  invulnerable: number;
  instabuild: number;
  flying: number;
  flySpeed: number;
  walkSpeed: number;
  mayBuild: number;
  mayFly: number;
}

export interface AttributeEntry {
  name: string;
  base: number;
  modifiers?: AttributeModifier[];
}

export interface InventoryEntry {
  id: string;
  slot?: number;
  count: number;
  damage: number;
  info?: InventoryEntryInfo;
}

export interface AttributeModifier {
  name: string;
  amount: number;
  operation: number;
  uuidLeast: number;
  uuidMost: number;
}

export interface ActiveEffect {
  id: number;
  base: number;
  ambient: number;
  amplifier: number;
  showParticles: number;
}

export interface InventoryEntryInfo {
  display?: InventoryEntryDisplay;
  repairCost?: number;
  enchantments: Enchantment[];
}

export interface InventoryEntryDisplay {
  name: string;
}

export interface Enchantment {
  id: number;
  level: number;
}
