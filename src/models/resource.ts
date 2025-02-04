export interface GameResourceInfo {
  id: string;
  gameType: string;
  releaseTime: string;
  url: string;
}

export type ModLoaderType = "none" | "Fabric" | "Forge" | "NeoForge";

export interface ModLoaderResourceInfo {
  type: ModLoaderType;
  version: string;
  description?: string;
  stable: boolean;
}

export const defaultModLoaderResourceInfo: ModLoaderResourceInfo = {
  type: "none",
  version: "",
  stable: true,
};
