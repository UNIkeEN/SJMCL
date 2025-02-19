import {
  GameInstanceSummary,
  LocalModInfo,
  ResourcePackInfo,
  SchematicInfo,
  ScreenshotInfo,
  ShaderPackInfo,
  WorldInfo,
} from "@/models/game-instance";

export const mockGameInstanceList: GameInstanceSummary[] = [
  {
    id: 1,
    iconSrc: "/images/icons/GrassBlock.png",
    name: "1.20.1 纯净生存整合包",
    version: "1.20.1",
    versionPath: "",
    modLoader: {
      loaderType: "Fabric",
      version: "0.15.6",
    },
    hasSchemFolder: false,
  },
  {
    id: 2,
    iconSrc: "/images/icons/Anvil.png",
    name: "Better MC [FORGE]",
    description: "更好的 MC 整合包",
    version: "1.20.1",
    versionPath: "",
    modLoader: {
      loaderType: "Forge",
      version: "47.2.17",
    },
    hasSchemFolder: true,
  },
];

export const mockResourcePacks: ResourcePackInfo[] = [
  {
    name: "Faithful 32x32",
    description: "The go-to 32x resource pack.\n§8November 2024 Pre-release",
    iconSrc:
      "https://media.forgecdn.net/avatars/546/645/637882030837320187.png",
    filePath: "/.minecraft/resourcepacks",
  },
  {
    name: "空白资源包",
    description: "测试空白资源包",
    iconSrc: "",
    filePath: "/.minecraft/resourcepacks",
  },
];

export const mockLocalMods: LocalModInfo[] = [
  {
    iconSrc:
      "https://media.forgecdn.net/avatars/thumbnails/92/854/64/64/636258666554688823.png",
    enabled: true,
    name: "Xaero's Minimap",
    transltedName: "Xaero 的小地图",
    version: "24.4.0",
    fileName: "Xaeros_Minimap_24.4.0_Fabric_1.20",
    description: "Displays the world nearby terrain, players, mobs",
    potentialIncompatibility: false,
  },
  {
    iconSrc:
      "https://media.forgecdn.net/avatars/thumbnails/29/69/64/64/635838945588716414.jpeg",
    enabled: false,
    name: "Just Enough Items (JEI)",
    transltedName: "JEI物品管理器",
    version: "15.20.0.106",
    fileName: "jei-1.20.1-fabric-15.20.0.106",
    description: "View items and recipes",
    potentialIncompatibility: true,
  },
];

export const mockSchematics: SchematicInfo[] = [
  {
    name: "TestFile.schematic",
    filePath: "/.minecraft/schematics",
  },
  {
    name: "McDonalds-Minhang-Campus.litematic",
    filePath: "/.minecraft/schematics",
  },
];
