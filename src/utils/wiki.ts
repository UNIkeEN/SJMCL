import { t } from "i18next";
import { GameClientResourceInfo } from "@/models/resource";
import { UtilsService } from "@/services/utils";

const SNAPSHOT_PATTERN = /^[0-9]{2}w[0-9]{2}.+$/;

/**
 * Obtain the Game Version Wikipedia URL suffix
 * @param locale Current Language
 * @returns Game Version Wikipedia URL suffix
 */
export const getChineseWikiVariantSuffix = async (
  locale: string
): Promise<string> => {
  if (locale.startsWith("zh")) {
    if (locale.endsWith("Hant")) {
      const res = await UtilsService.getSystemRegion();
      if (res.status === "success") {
        console.log(res.data);
        return res.data === "HK" || res.data === "MO"
          ? "?variant=zh-hk"
          : "?variant=zh-tw";
      }
    } else {
      return "?variant=zh-cn";
    }
  }
  return "";
};

export const getGameVersionWikiLink = async (
  locale: string,
  version: GameClientResourceInfo
): Promise<string> => {
  let wikiVersion = version.id;

  const variantSuffix = await getChineseWikiVariantSuffix(locale);

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
