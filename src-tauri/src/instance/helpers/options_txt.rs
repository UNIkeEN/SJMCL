use tauri::AppHandle;

use crate::instance::helpers::game_version::build_game_version_cmp_fn;

/// Ordered by `min_version` ascending so that `.last()` on a filtered iterator
/// picks the best (highest) matching version for a given locale.
const LANG_TAG_MAPPINGS: &[(&str, &str, &str)] = &[
  // Legacy format (≥ 1.1)
  ("en", "1.1", "en_US"),
  ("es", "1.1", "es_ES"),
  ("fr", "1.1", "fr_FR"),
  ("ja", "1.1", "ja_JP"),
  ("zh-Hans", "1.1", "zh_CN"),
  ("zh-Hant", "1.1", "zh_TW"),
  ("lzh", "1.1", "zh_CN"), // fallback
  // Modern format (≥ 1.11)
  ("en", "1.11", "en_us"),
  ("es", "1.11", "es_es"),
  ("fr", "1.11", "fr_fr"),
  ("ja", "1.11", "ja_jp"),
  ("zh-Hans", "1.11", "zh_cn"),
  ("zh-Hant", "1.11", "zh_tw"),
  ("lzh", "1.11", "zh_cn"),
  // newer version available (≥ 1.17.1)
  ("lzh", "1.17.1", "lzh"),
];

pub fn get_minecraft_lang_tag(
  launcher_locale: &str,
  game_version: &str,
  app: &AppHandle,
) -> Option<&'static str> {
  // ref: https://github.com/HMCL-dev/HMCL/blob/6a497df0d1cd873698100707a25f7272d344416e/HMCL/src/main/java/org/jackhuang/hmcl/game/HMCLGameLauncher.java#L87
  let cmp = build_game_version_cmp_fn(app);
  LANG_TAG_MAPPINGS
    .iter()
    .filter(|(locale, min_ver, _)| *locale == launcher_locale && cmp(game_version, min_ver).is_ge())
    .next_back()
    .map(|(_, _, tag)| *tag)
}

// TBD: struct of options.txt and more helpers?
