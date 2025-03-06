import { ResourcePackInfo, SchematicInfo } from "@/models/instance/misc";

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
