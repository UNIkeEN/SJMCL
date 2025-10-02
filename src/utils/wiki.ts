import { useTranslation } from "react-i18next";
import { GameClientResourceInfo } from "@/models/resource";

const SNAPSHOT_PATTERN = /^[0-9]{2}w[0-9]{2}.+$/;

export const getWikiLink = (
  t: ReturnType<typeof useTranslation>[0],
  locale: string,
  version: GameClientResourceInfo
): string => {
  let wikiVersion = version.id;

  let variantSuffix = "";
  if (locale.startsWith("zh")) {
    variantSuffix = locale.endsWith("Hant")
      ? "?variant=zh-tw"
      : "?variant=zh-cn";
  }

  if (version.gameType == "snapshot") {
    return (
      t("Utils.wiki.url-snapshot", {
        version: wikiVersion,
      }) + variantSuffix
    );
  } else {
    if (wikiVersion.length >= 6 && wikiVersion.charAt(2) === "w") {
      if (SNAPSHOT_PATTERN.test(wikiVersion)) {
        if (wikiVersion === "22w13oneblockatatime") {
          wikiVersion = "22w13oneBlockAtATime";
        }
        return (
          t("Utils.wiki.url-snapshot", {
            version: wikiVersion,
          }) + variantSuffix
        );
      }
    }

    const lower = wikiVersion.toLocaleLowerCase(locale);

    if (lower.startsWith("b")) {
      wikiVersion = lower.replace("b", "Beta_");
    }
  }

  return (
    t("Utils.wiki.url", {
      version: wikiVersion,
    }) + variantSuffix
  );
};
