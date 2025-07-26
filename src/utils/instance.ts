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
    `${instance.modLoader.loaderType} ${parseModLoaderVersion(instance.modLoader.version || "")}`,
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

export const parseModLoaderVersion = (version: string): string => {
  const patterns = [
    {
      // Forge: "1.16.5-forge-36.2.39"
      regex: /(\d+\.\d+\.\d+)-forge-(\d+\.\d+\.\d+)/,
      getVersion: (match: RegExpMatchArray) => match[2],
    },
    {
      // NeoForge: "neoforge-21.8.13" or "1.20.1-neoforge-47.0.44"
      regex: /(neoforge|\d+\.\d+\.\d+)-(\d+\.\d+\.\d+)/,
      getVersion: (match: RegExpMatchArray) => match[2],
    },
  ];

  for (const { regex, getVersion } of patterns) {
    const match = version.match(regex);
    if (match) {
      return getVersion(match);
    }
  }

  return version;
};
