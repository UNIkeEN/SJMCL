import { ModLoaderType } from "@/enums/instance";
import {
  DependencyType,
  OtherResourceSource,
  OtherResourceType,
} from "@/enums/resource";

export interface GameClientResourceInfo {
  id: string;
  gameType: string;
  releaseTime: string;
  url: string;
}

export interface OtherResourceInfo {
  id?: string; // got from API
  mcmodId?: number; //got from mod database in backend
  websiteUrl?: string;
  type: OtherResourceType;
  name: string;
  translatedName?: string;
  description: string;
  translatedDescription?: string;
  iconSrc: string;
  tags: string[];
  lastUpdated: string;
  downloads: number;
  source?: OtherResourceSource;
}

export interface OtherResourceSearchRes {
  list: OtherResourceInfo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OtherResourceFileInfo {
  resourceId: string;
  name: string;
  releaseType: string;
  downloads: number;
  fileDate: string;
  downloadUrl: string;
  sha1: string;
  fileName: string;
  dependencies: OtherResourceDependency[];
  loader?: string; // "forge", "fabric", "iris", "optifine", etc.
}

export interface OtherResourceDependency {
  resourceId: string;
  relation: DependencyType;
  resource?: OtherResourceInfo;
}

export interface OtherResourceVersionPack {
  name: string;
  items: OtherResourceFileInfo[];
}

export interface ModLoaderResourceInfo {
  loaderType: ModLoaderType;
  version: string;
  description: string;
  stable: boolean;
  branch?: string;
}

export const defaultModLoaderResourceInfo: ModLoaderResourceInfo = {
  loaderType: ModLoaderType.Unknown,
  version: "",
  description: "",
  stable: true,
};

export interface OptiFineResourceInfo {
  filename: string;
  patch: string;
  type: string;
}

export interface ModUpdateRecord {
  name: string;
  curVersion: string;
  newVersion: string;
  source: string;
  downloadUrl: string;
  sha1: string;
  fileName: string;
}

export interface ModUpdateQuery {
  url: string;
  sha1: string;
  fileName: string;
  oldFilePath: string;
}
