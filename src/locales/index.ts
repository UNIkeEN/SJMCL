import { i18nConfig } from "../../next-i18next.config.mjs";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import ja from "./ja.json";
import lzh from "./lzh.json";
import zh_Hans from "./zh-Hans.json";
import zh_Hant from "./zh-Hant.json";

type LocaleResources = {
  [key: string]: {
    translation: Record<string, any>;
    display_name: string;
    htmlLang: string;
  };
};

export const localeResources: LocaleResources = {
  en: {
    translation: en,
    display_name: "English",
    htmlLang: "en",
  },
  es: {
    translation: es,
    display_name: "Español",
    htmlLang: "es",
  },
  fr: {
    translation: fr,
    display_name: "Français",
    htmlLang: "fr",
  },
  ja: {
    translation: ja,
    display_name: "日本語",
    htmlLang: "ja",
  },
  "zh-Hans": {
    translation: zh_Hans,
    display_name: "简体中文",
    htmlLang: "zh-Hans",
  },
  "zh-Hant": {
    translation: zh_Hant,
    display_name: "繁體中文",
    htmlLang: "zh-Hant",
  },
  lzh: {
    translation: lzh,
    display_name: "文言",
    htmlLang: "zh",
  },
};

export const DEFAULT_LOCALE = i18nConfig.defaultLocale;
