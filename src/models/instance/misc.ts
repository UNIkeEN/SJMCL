import { ModLoaderType } from "@/enums/instance";
import { OtherResourceSource } from "@/enums/resource";

export enum ModLoaderStatus {
  NotDownloaded = "NotDownloaded",
  Downloading = "Downloading",
  DownloadFailed = "DownloadFailed",
  Installing = "Installing",
  Installed = "Installed",
}

export interface ModLoader {
  status: ModLoaderStatus;
  loaderType: ModLoaderType;
  version?: string;
  branch?: string;
}

export interface OptiFine {
  filename: string;
  version: string;
  status: ModLoaderStatus;
}

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
  modLoader: ModLoader;
  optifine?: OptiFine;
  supportQuickPlay: boolean;
  useSpecGameConfig: boolean;
  isVersionIsolated: boolean;
}

export interface ModpackMetaInfo {
  name: string;
  version: string;
  author?: string;
  description?: string;
  modpackType: OtherResourceSource;
  clientVersion: string;
  modLoader?: ModLoader;
}

export interface GameServerInfo {
  iconSrc: string;
  ip: string;
  name: string;
  description: string;
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
  translatedDescription?: string;
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
