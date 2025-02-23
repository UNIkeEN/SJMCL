export enum InstanceSubdirEnums {
  Assets = "Assets",
  Libraries = "Libraries",
  Mods = "Mods",
  ResourcePacks = "ResourcePacks",
  Root = "Root",
  Saves = "Saves",
  Schematics = "Schematics",
  Screenshots = "Screenshots",
  ServerResourcePacks = "ServerResourcePacks",
  ShaderPacks = "ShaderPacks",
}

export enum ModLoaderEnums {
  Unknown = "Unknown",
  Fabric = "Fabric",
  Forge = "Forge",
  ForgeOld = "ForgeOld",
  NeoForge = "NeoForge",
  LiteLoader = "LiteLoader",
  Quilt = "Quilt",
}

export type ModLoaderType = `${ModLoaderEnums}`;
