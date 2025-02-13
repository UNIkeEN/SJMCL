import {
  GameInstanceSummary,
  GameServerInfo,
  LocalModInfo,
  ResourcePacksInfo,
  SchematicsInfo,
  Screenshot,
  ShaderPacksInfo,
  WorldInfo,
} from "@/models/game-instance";

export const mockGameInstanceList: GameInstanceSummary[] = [
  {
    id: 1,
    uuid: "aaaaaaaa-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    iconSrc: "/images/icons/GrassBlock.png",
    name: "1.20.1 纯净生存整合包",
    version: "1.20.1",
    modLoader: {
      type: "Fabric",
      version: "0.15.6",
    },
    hasSchemFolder: false,
  },
  {
    id: 2,
    uuid: "00000000-0000-0000-0000-000000000000",
    iconSrc: "/images/icons/Anvil.png",
    name: "Better MC [FORGE]",
    description: "更好的 MC 整合包",
    version: "1.20.1",
    modLoader: {
      type: "Forge",
      version: "47.2.17",
    },
    hasSchemFolder: true,
  },
];

export const mockScreenshots: Screenshot[] = [
  {
    fileName: "樱の小屋1",
    filePath: "/screenshots/screenshot1.png",
    imgSrc:
      "https://mc.sjtu.cn/wiki/images/8/80/%E6%A8%B1%E3%81%AE%E5%B0%8F%E5%B1%8B-1.jpg",
    time: "2025.01.01",
  },
  {
    fileName: "樱の小屋2",
    filePath: "/screenshots/screenshot2.png",
    imgSrc:
      "https://mc.sjtu.cn/wiki/images/8/87/%E6%A8%B1%E3%81%AE%E5%B0%8F%E5%B1%8B-2.jpg",
    time: "2025.01.02",
  },
  {
    fileName: "亭子",
    filePath: "/screenshots/screenshot3.png",
    imgSrc: "https://mc.sjtu.cn/wiki/images/4/48/%E4%BA%AD%E5%AD%90.png",
    time: "2025.01.03",
  },
  {
    fileName: "桥",
    filePath: "/screenshots/screenshot4.png",
    imgSrc: "https://mc.sjtu.cn/wiki/images/2/2f/%E6%A1%A5.png",
    time: "2025.01.04",
  },
];

export const mockWorlds: WorldInfo[] = [
  {
    name: "Dev-SJMC",
    lastPlayedAt: "2024-12-18T10:00:00Z",
    difficulty: "normal",
    gamemode: "survival",
    iconSrc: "/images/icons/GrassBlock.png",
    filePath: "/.minecraft/saves",
  },
  {
    name: "SMP-SJMC",
    lastPlayedAt: "2024-12-18T10:00:00Z",
    difficulty: "hard",
    gamemode: "creative",
    iconSrc: "/images/icons/Anvil.png",
    filePath: "/.minecraft/saves",
  },
];

export const mockResourcePacks: ResourcePacksInfo[] = [
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

export const mockShaderPacks: ShaderPacksInfo[] = [
  {
    name: "Kappa_v5.2",
    filePath: "/.minecraft/shaderpacks",
  },
  {
    name: "rethinking-voxels_r0.1_beta2",
    filePath: "/.minecraft/shaderpacks",
  },
  {
    name: "§r§lAstra§4§lLex§r§l_By_LexBoosT_§4§lV93.0§r§l",
    filePath: "/.minecraft/shaderpacks",
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

export const mockSchematics: SchematicsInfo[] = [
  {
    name: "TestFile.schematic",
    filePath: "/.minecraft/schematics",
  },
  {
    name: "McDonalds-Minhang-Campus.litematic",
    filePath: "/.minecraft/schematics",
  },
];
