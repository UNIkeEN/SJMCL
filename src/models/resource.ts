import { ModLoaderType } from "@/enums/instance";

export interface GameResourceInfo {
  id: string;
  gameType: string;
  releaseTime: string;
  url: string;
}

export interface OtherResourceInfo {
  id?: string; // got from API
  websiteUrl?: string;
  type: "mod" | "world" | "resourcepack" | "shader" | "modpack" | "datapack";
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

export interface ResourceFileInfo {
  name: string;
  releaseType: string;
  downloads: number;
  fileDate: string;
  downloadUrl: string;
  fileName: string;
}

export interface ResourceVersionPack {
  name: string;
  items: ResourceFileInfo[];
}

export interface ModLoaderResourceInfo {
  loaderType: ModLoaderType;
  version: string;
  description?: string;
  stable: boolean;
}

export const defaultModLoaderResourceInfo: ModLoaderResourceInfo = {
  loaderType: "Unknown",
  version: "",
  stable: true,
};
