import { t } from "i18next";

export const buildWikiUrl = (
  key: string,
  params?: Record<string, string>
): string => {
  const baseUrl = t("Utils.wiki.baseUrl", { key });
  const query = new URLSearchParams(params).toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
};

export const getGameVersionWikiLink = (version: string): string => {
  // not depending on version type beacause of some pre-release, rc and april fools versions
  const SNAPSHOT_PATTERN = /^[0-9]{2}w[0-9]{2}.+$/;

  if (SNAPSHOT_PATTERN.test(version)) {
    return buildWikiUrl(version);
  }

  const lower = version.toLowerCase();
  if (lower.startsWith("b")) {
    version = lower.replace("b", "Beta_");
  }

  return buildWikiUrl(t("Utils.wiki.key.javaEdition", { version }));
};
