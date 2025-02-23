import { PostSourceInfo, PostSummary } from "@/models/post";

export const mockPostSources: PostSourceInfo[] = [
  {
    name: "SJMC",
    fullName: "上海交通大学 Minecraft 社",
    endpointUrl: "https://mc.sjtu.cn/",
    iconSrc: "https://mc.sjtu.cn/wp-content/uploads/2022/03/mcclub-512px.png",
  },
  {
    endpointUrl: "https://api.mock.url/", // no other field, as offline / pending
  },
];

export const mockPosts: PostSummary[] = [
  {
    title: "Minecraft 1.21 更新",
    abstracts: "嘎吱，嘎吱",
    keywords: " 新闻, 游戏更新,Minecraft,官方",
    imageSrc:
      "https://zh.minecraft.wiki/images/thumb/The_Garden_Awakens_Artwork.jpg/600px-The_Garden_Awakens_Artwork.jpg?325b7",
    source: {
      endpointUrl: "https://mc.sjtu.cn/",
    },
    updateAt: "2024-08-03T08:00:00Z",
    link: "",
  },
  {
    title: "⛏️",
    abstracts: "争取至少为社团健康工作五十年",
    keywords: "SJMC,社员",
    imageSrc: "https://skin.mc.sjtu.cn/preview/3.png",
    source: {
      name: "SJMC",
      endpointUrl: "https://mc.sjtu.cn/",
      iconSrc: "https://mc.sjtu.cn/wp-content/uploads/2022/03/mcclub-512px.png",
    },
    updateAt: "2024-12-04T08:00:00Z",
    link: "https://mc.sjtu.cn/wiki/?curid=658",
  },
  {
    title: "SMP 年度报告",
    keywords: "  ",
    imageSrc:
      "https://mc.sjtu.cn/wiki/images/e/e3/SMP2.0-%E5%B9%B4%E5%BA%A6%E6%80%BB%E7%BB%93-1.png",
    source: {
      name: "SJMC",
      endpointUrl: "https://mc.sjtu.cn/",
      iconSrc: "https://mc.sjtu.cn/wp-content/uploads/2022/03/mcclub-512px.png",
    },
    updateAt: "2025-01-04T00:00:00Z",
    link: "https://mc.sjtu.cn/wiki/?curid=611",
  },
  {
    title: "走进方块交大",
    abstracts: "以心为砖，以爱为瓦，一砖一瓦，方块交大",
    keywords: "SJMC",
    imageSrc:
      "https://mc.sjtu.cn/welcome/_next/static/media/bg-light.333750fa.png",
    source: {
      endpointUrl: "https://mc.sjtu.cn/",
    },
    updateAt: "2025-01-04T01:33:00Z",
    link: "https://mc.sjtu.cn/welcome/content/2/",
  },
  {
    title: "Senko",
    abstracts: "这是仙，她很可爱",
    imageSrc: "https://mc.sjtu.cn/wiki/images/1/1b/Senko.gif",
    source: {
      name: "SJMC",
      endpointUrl: "https://mc.sjtu.cn/",
      iconSrc: "https://mc.sjtu.cn/wp-content/uploads/2022/03/mcclub-512px.png",
    },
    updateAt: "2025-01-04T02:00:00Z",
    link: "",
  },
];
