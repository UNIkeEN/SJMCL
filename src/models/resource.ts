import { ModLoaderType } from "@/enums/instance";
import { OtherResourceType } from "@/enums/resource";

export interface GameResourceInfo {
  id: string;
  gameType: string;
  releaseTime: string;
  url: string;
}

export interface OtherResourceInfo {
  id?: string; // got from API
  websiteUrl?: string;
  type: OtherResourceType;
  name: string;
  translatedName?: string;
  description: string;
  iconSrc: string;
  tags: string[];
  lastUpdated: string;
  downloads: number;
  source?: string; // CurseForge, Modrinth, etc.
}

export interface OtherResourceSearchRes {
  list: OtherResourceInfo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OtherResourceFileInfo {
  name: string;
  releaseType: string;
  downloads: number;
  fileDate: string;
  downloadUrl: string;
  sha1: string;
  fileName: string;
  loader?: string; // "forge", "fabric", "iris", "optifine", etc.
}

export interface OtherResourceVersionPack {
  name: string;
  items: OtherResourceFileInfo[];
}

export interface ModLoaderResourceInfo {
  loaderType: ModLoaderType;
  version: string;
  description?: string;
  stable: boolean;
}

export const defaultModLoaderResourceInfo: ModLoaderResourceInfo = {
  loaderType: ModLoaderType.Unknown,
  version: "",
  stable: true,
};

export interface ModLoader {
  loaderType: ModLoaderType;
  version: string;
}
