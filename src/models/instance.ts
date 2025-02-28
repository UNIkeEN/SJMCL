import { ModLoaderType } from "@/enums/instance";

export interface GameInstanceSummary {
  id: number;
  iconSrc: string;
  name: string;
  description?: string;
  versionPath: string;
  version: string;
  isVersionIsolated: boolean;
  modLoader: {
    loaderType: ModLoaderType;
    version?: string;
  };
}

export interface WorldInfo {
  name: string;
  lastPlayedAt: number;
  difficulty: string;
  gamemode: string;
  iconSrc: string;
  dirPath: string;
}

export interface GameServerInfo {
  iconSrc: string;
  ip: string;
  name: string;
  isQueried: boolean;
  playersOnline?: number;
  playersMax?: number;
  online: boolean;
}

export interface LocalModInfo {
  iconSrc: string;
  enabled: boolean;
  name: string;
  translatedName?: string;
  version: string;
  loaderType: ModLoaderType;
  fileName: string;
  filePath: string;
  description?: string;
  potentialIncompatibility: boolean;
}

export interface ResourcePackInfo {
  name: string;
  description?: string;
  iconSrc?: string;
  filePath: string;
}

export interface SchematicInfo {
  name: string;
  filePath: string;
}

export interface ShaderPackInfo {
  fileName: string;
  filePath: string;
}

export interface ScreenshotInfo {
  fileName: string;
  filePath: string;
  time: number; // UNIX timestamp
}

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
