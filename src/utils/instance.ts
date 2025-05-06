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

export const getGameDirName = (dir: string | GameDirectory) => {
  const name = typeof dir === "string" ? dir : dir.name;

  return ["CURRENT_DIR", "OFFICIAL_DIR"].includes(name)
    ? t(
        `GlobalGameSettingsPage.directories.settings.directories.special.${name}`
      )
    : name;
};
