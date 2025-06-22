import { t } from "i18next";
import { ModLoaderType } from "@/enums/instance";
import { GameDirectory } from "@/models/config";
import { InstanceSummary } from "@/models/instance/misc";

export const generateInstanceDesc = (instance: InstanceSummary) => {
  if (instance.modLoader.loaderType === ModLoaderType.Unknown) {
    return instance.version || "";
  }
  return [
    instance.version,
    `${instance.modLoader.loaderType} ${instance.modLoader.version}`,
  ]
    .filter(Boolean)
    .join(", ");
};

const SPECIAL_GAME_DIR_NAMES = [
  "CURRENT_DIR",
  "APP_DATA_SUBDIR",
  "OFFICIAL_DIR",
];

export const isSpecialGameDir = (dir: string | GameDirectory): boolean => {
  const name = typeof dir === "string" ? dir : dir.name;
  return SPECIAL_GAME_DIR_NAMES.includes(name);
};

export const getGameDirName = (dir: string | GameDirectory) => {
  const name = typeof dir === "string" ? dir : dir.name;

  return isSpecialGameDir(name)
    ? t(
        `GlobalGameSettingsPage.directories.settings.directories.special.${name}`
      )
    : name;
};
