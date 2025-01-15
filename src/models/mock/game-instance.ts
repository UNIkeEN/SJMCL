import {
  GameInstanceSummary,
  GameServerInfo,
  ResourcePacksInfo,
  Screenshot,
  ShaderPacksInfo,
  WorldInfo,
} from "@/models/game-instance";

export const mockGameInstanceSummaryList: GameInstanceSummary[] = [
  {
    id: 1,
    uuid: "aaaaaaaa-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    iconSrc: "/images/icons/GrassBlock.webp",
    name: "1.20.1 纯净生存整合包",
    version: "1.20.1",
    modLoader: {
      type: "Fabric",
      version: "0.15.6",
    },
  },
  {
    id: 2,
    uuid: "00000000-0000-0000-0000-000000000000",
    iconSrc: "/images/icons/Anvil.webp",
    name: "Better MC [FORGE]",
    description: "更好的 MC 整合包",
    version: "1.20.1",
    modLoader: {
      type: "Forge",
      version: "47.2.17",
    },
  },
];

export const mockScreenshots: Screenshot[] = [
  {
    fileName: "樱の小屋1",
    filePath: "/screenshots/screenshot1.png",
    imgSrc:
      "https://mc.sjtu.cn/wiki/images/8/80/%E6%A8%B1%E3%81%AE%E5%B0%8F%E5%B1%8B-1.jpg",
  },
  {
    fileName: "樱の小屋2",
    filePath: "/screenshots/screenshot2.png",
    imgSrc:
      "https://mc.sjtu.cn/wiki/images/8/87/%E6%A8%B1%E3%81%AE%E5%B0%8F%E5%B1%8B-2.jpg",
  },
  {
    fileName: "亭子",
    filePath: "/screenshots/screenshot3.png",
    imgSrc: "https://mc.sjtu.cn/wiki/images/4/48/%E4%BA%AD%E5%AD%90.png",
  },
  {
    fileName: "桥",
    filePath: "/screenshots/screenshot4.png",
    imgSrc: "https://mc.sjtu.cn/wiki/images/2/2f/%E6%A1%A5.png",
  },
];

export const mockGameserver: GameServerInfo[] = [
  {
    icon: "data:image/png;base64,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",
    ip: "smp2.sjmc.club",
    name: "SJMC-SMP2.6",
  },
];

export const mockWorlds: WorldInfo[] = [
  {
    name: "Dev-SJMC",
    lastPlayedAt: "2024-12-18T10:00:00Z",
    iconUrl: "/images/icons/GrassBlock.webp",
    fileDir: "/.minecraft/saves",
  },
  {
    name: "SMP-SJMC",
    lastPlayedAt: "2024-12-18T10:00:00Z",
    iconUrl: "/images/icons/Anvil.webp",
    fileDir: "/.minecraft/saves",
  },
];

export const mockResourcePacks: ResourcePacksInfo[] = [
  {
    name: "Faithful 32x32",
    description: "The go-to 32x resource pack.\n§8November 2024 Pre-release",
    iconUrl:
      "https://media.forgecdn.net/avatars/546/645/637882030837320187.png",
    fileDir: "/.minecraft/resourcepacks",
  },
  {
    name: "空白资源包",
    description: "测试空白资源包",
    iconUrl: "",
    fileDir: "/.minecraft/resourcepacks",
  },
];

export const mockShaderPacks: ShaderPacksInfo[] = [
  {
    name: "Kappa_v5.2",
    fileDir: "/.minecraft/shaderpacks",
  },
  {
    name: "rethinking-voxels_r0.1_beta2",
    fileDir: "/.minecraft/shaderpacks",
  },
  {
    name: "§r§lAstra§4§lLex§r§l_By_LexBoosT_§4§lV93.0§r§l",
    fileDir: "/.minecraft/shaderpacks",
  },
];
