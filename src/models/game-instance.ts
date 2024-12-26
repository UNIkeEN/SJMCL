export interface GameInstanceSummary {
  id: number;
  uuid: string;
  iconSrc: string;
  name: string;
  description: string;
}

export interface Screenshot {
  fileName: string;
  filePath: string;
  imgSrc: string;
}

export interface WorldInfo {
  name: string;
  lastPlayedAt: string;
  iconUrl: string;
  fileDir: string;
}

export interface GameServerInfo {
  icon: string;
  ip: string;
  name: string;
}

export interface ResourcePacksInfo {
  name: string;
  description?: string;
  iconUrl?: string;
  fileDir: string;
}

export interface ShaderPacksInfo {
  name: string;
  fileDir: string;
}
