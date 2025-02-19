import { ModLoaderType } from "@/models/resource";

export interface GameInstanceSummary {
  id: number;
  iconSrc: string;
  name: string;
  description?: string;
  versionPath: string;
  version: string;
  modLoader: {
    loaderType: ModLoaderType;
    version?: string;
  };
  hasSchemFolder: boolean;
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
  transltedName?: string;
  version: string;
  fileName: string;
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
