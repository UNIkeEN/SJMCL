import { ModLoaderType } from "@/enums/instance";

export interface InstanceSummary {
  id: string;
  iconSrc: string;
  name: string;
  description?: string;
  starred: boolean;
  playTime: number;
  versionPath: string;
  version: string;
  majorVersion: string;
  isVersionIsolated: boolean;
  modLoader: {
    loaderType: ModLoaderType;
    version?: string;
  };
  useSpecGameConfig: boolean;
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
