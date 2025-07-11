use serde_json::json;
use tauri_plugin_http::reqwest;
use tauri_plugin_os::locale;

/// Sends app version and OS type as statistic data to SJMC asynchronously.
///
/// # Examples
///
/// ```rust
/// send_statistics("1.0.0".to_string(), "windows".to_string()).await;
/// ```
pub async fn send_statistics(version: String, os: String) {
  _ = reqwest::Client::new()
    .post("https://mc.sjtu.cn/api-sjmcl/statistics")
    .json(&json!({
      "version": version,
      "os": os,
    }))
    .send()
    .await;
}

/// Returns a locale identifier standardized for frontend usage
/// by mapping OS-specific locale strings. Defaults to "en" if no match is found.
///
/// # Examples
///
/// ```rust
/// let locale = get_mapped_locale();
/// println!("Locale: {}", locale);
/// ```
pub fn get_mapped_locale() -> String {
  // only apple can do 🌈🧑🏻‍🍳👐🏻
  // The return value of tauri_plugin_os::locale() on macOS(e.g. zh-Hans-CN) differs from that on Windows and Linux(e.g. zh-CN).
  let locale = locale().unwrap();
  let matched_locale;

  #[cfg(target_os = "macos")]
  {
    let language_map = [
      ("zh-Hans", vec!["zh-Hans", "wuu-Hans", "yue-Hans"]),
      ("zh-Hant", vec!["zh-Hant", "yue-Hant"]),
      ("fr", vec!["fr"]),
    ];

    matched_locale = language_map
      .iter()
      .find(|(_, locales)| locales.iter().any(|l| locale.starts_with(l)))
      .map(|(mapped, _)| mapped.to_string());
  }

  #[cfg(not(target_os = "macos"))]
  {
    let language_map = [
      ("zh-Hans", vec!["zh-CN"]),
      ("zh-Hant", vec!["zh-TW", "zh-HK", "zh-MO"]),
      ("fr", vec!["fr"]),
    ];

    matched_locale = language_map
      .iter()
      .find(|(_, locales)| locales.contains(&locale.as_str()))
      .map(|(mapped, _)| mapped.to_string());
  }

  matched_locale.unwrap_or_else(|| "en".to_string()) // fallback to "en"
}
