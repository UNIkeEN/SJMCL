import { GameInstanceSummary, Screenshot } from "@/models/game-instance";

export const mockGameInstanceSummaryList: GameInstanceSummary[] = [
  {
    id: 1,
    uuid: "aaaaaaaa-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    iconSrc: "/images/GrassBlock.webp",
    name: "1.20.1 纯净生存整合包",
    description: "1.20.1, Fabric: 0.15.6",
  },
  {
    id: 2,
    uuid: "00000000-0000-0000-0000-000000000000",
    iconSrc: "/images/Anvil.webp",
    name: "Better MC [FORGE]",
    description: "1.20.1, Forge: 47.2.17",
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
