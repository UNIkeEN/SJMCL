import { t } from "i18next";
import {
  OtherResourceSource,
  OtherResourceType,
  datapackTagList,
  modTagList,
  modpackTagList,
  resourcePackTagList,
  shaderPackTagList,
  worldTagList,
} from "@/enums/resource";

const tagLists: Record<string, any> = {
  mod: modTagList,
  world: worldTagList,
  resourcepack: resourcePackTagList,
  shader: shaderPackTagList,
  modpack: modpackTagList,
  datapack: datapackTagList,
};

export const translateTag = (
  tag: string,
  resourceType?: OtherResourceType,
  downloadSource?: OtherResourceSource
) => {
  if (downloadSource && resourceType) {
    const tagList = (tagLists[resourceType] || modpackTagList)[downloadSource];
    let allTags: string[] = [];
    if (typeof tagList === "object" && tagList !== null) {
      const keys = Object.keys(tagList);
      const values = Object.values(tagList).flat() as string[];
      allTags = [...keys, ...values];
    }
    if (!allTags.includes(tag)) return "";
    return t(
      `ResourceDownloader.${resourceType}TagList.${downloadSource}.${tag}`
    );
  }
  return tag;
};
