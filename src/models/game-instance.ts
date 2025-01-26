export interface GameInstanceSummary {
  id: number;
  uuid: string;
  iconSrc: string;
  name: string;
  description?: string;
  version: string;
  modLoader: {
    type: "none" | "Fabric" | "Forge" | "NeoForge";
    version?: string;
  };
}

export interface Screenshot {
  fileName: string;
  filePath: string;
  imgSrc: string;
}

export interface WorldInfo {
  name: string;
  lastPlayedAt: string;
  iconSrc: string;
  fileDir: string;
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

export interface ResourcePacksInfo {
  name: string;
  description?: string;
  iconSrc?: string;
  fileDir: string;
}

export interface ShaderPacksInfo {
  name: string;
  fileDir: string;
}
