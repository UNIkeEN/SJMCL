import { t } from "i18next";
import { ModLoaderEnums } from "@/enums/instance";
import { GameDirectory } from "@/models/config";
import { InstanceSummary } from "@/models/instance/misc";

export const generateInstanceDesc = (instance: InstanceSummary) => {
  if (instance.modLoader.loaderType === ModLoaderEnums.Unknown) {
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

export function isSpecialGameDirName(name: string): boolean {
  return SPECIAL_GAME_DIR_NAMES.includes(name);
}

export const getGameDirName = (dir: string | GameDirectory) => {
  const name = typeof dir === "string" ? dir : dir.name;

  return isSpecialGameDirName(name)
    ? t(
        `GlobalGameSettingsPage.directories.settings.directories.special.${name}`
      )
    : name;
};
