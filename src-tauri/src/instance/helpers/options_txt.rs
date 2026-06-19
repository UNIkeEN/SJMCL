use tauri::AppHandle;

use crate::instance::helpers::game_version::compare_game_versions;

fn get_minecraft_lang_tag_by_format(
  launcher_locale: &str,
  use_modern_format: bool,
) -> Option<&'static str> {
  match (launcher_locale, use_modern_format) {
    ("en", true) => Some("en_us"),
    ("en", false) => Some("en_US"),
    ("es", true) => Some("es_es"),
    ("es", false) => Some("es_ES"),
    ("fr", true) => Some("fr_fr"),
    ("fr", false) => Some("fr_FR"),
    ("ja", true) => Some("ja_jp"),
    ("ja", false) => Some("ja_JP"),
    ("zh-Hans", true) => Some("zh_cn"),
    ("zh-Hans", false) => Some("zh_CN"),
    ("zh-Hant", true) => Some("zh_tw"),
    ("zh-Hant", false) => Some("zh_TW"),
    ("lzh", _) => Some("lzh"),
    _ => None,
  }
}

pub async fn get_minecraft_lang_tag(
  launcher_locale: &str,
  game_version: &str,
  app: &AppHandle,
) -> Option<&'static str> {
  // ref: https://github.com/HMCL-dev/HMCL/blob/6a497df0d1cd873698100707a25f7272d344416e/HMCL/src/main/java/org/jackhuang/hmcl/game/HMCLGameLauncher.java#L87
  if compare_game_versions(app, game_version, "1.1", false)
    .await
    .is_lt()
  {
    None
  } else if compare_game_versions(app, game_version, "1.11", false)
    .await
    .is_ge()
  {
    get_minecraft_lang_tag_by_format(launcher_locale, true)
  } else {
    get_minecraft_lang_tag_by_format(launcher_locale, false)
  }
}

// TBD: struct of options.txt and more helpers?

#[cfg(test)]
mod tests {
  use super::get_minecraft_lang_tag_by_format;

  #[test]
  fn maps_supported_launcher_locales_to_modern_minecraft_lang_tags() {
    let cases = [
      ("en", "en_us"),
      ("es", "es_es"),
      ("fr", "fr_fr"),
      ("ja", "ja_jp"),
      ("zh-Hans", "zh_cn"),
      ("zh-Hant", "zh_tw"),
      ("lzh", "lzh"),
    ];

    for (launcher_locale, expected_lang_tag) in cases {
      assert_eq!(
        get_minecraft_lang_tag_by_format(launcher_locale, true),
        Some(expected_lang_tag)
      );
    }
  }

  #[test]
  fn maps_supported_launcher_locales_to_legacy_minecraft_lang_tags() {
    let cases = [
      ("en", "en_US"),
      ("es", "es_ES"),
      ("fr", "fr_FR"),
      ("ja", "ja_JP"),
      ("zh-Hans", "zh_CN"),
      ("zh-Hant", "zh_TW"),
      ("lzh", "lzh"),
    ];

    for (launcher_locale, expected_lang_tag) in cases {
      assert_eq!(
        get_minecraft_lang_tag_by_format(launcher_locale, false),
        Some(expected_lang_tag)
      );
    }
  }

  #[test]
  fn ignores_unknown_launcher_locales() {
    assert_eq!(get_minecraft_lang_tag_by_format("de", true), None);
    assert_eq!(get_minecraft_lang_tag_by_format("", false), None);
  }
}
