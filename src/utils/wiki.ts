import { useTranslation } from "react-i18next";
import { GameClientResourceInfo } from "@/models/resource";

const SNAPSHOT_PATTERN = /^[0-9]{2}w[0-9]{2}.+$/;

export const getWikiLink = (
  t: ReturnType<typeof useTranslation>[0],
  locale: string,
  version: GameClientResourceInfo
): string => {
  let wikiVersion = version.id;
  if (SNAPSHOT_PATTERN.test(wikiVersion)) {
    return t("Utils.wiki.url-snapshot", {
      version: wikiVersion,
    });
  }

  const lower = wikiVersion.toLocaleLowerCase(locale);

  if (lower.startsWith("b")) {
    wikiVersion = lower.replace("b", "Beta_");
  }

  return t("Utils.wiki.url", {
    version: wikiVersion,
  });
};
