use serde_json::json;
use tauri_plugin_http::reqwest;
use tauri_plugin_os::locale;

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

pub fn get_mapped_locale() -> String {
  let locale = locale().unwrap();
  // only apple can do 🌈🧑🏻‍🍳👐🏻
  // The return value of tauri_plugin_os::locale() on macOS(e.g. zh-Hans-CN) differs from that on Windows and Linux(e.g. zh-CN).

  let language_map = [
    (
      "zh-Hans",
      vec!["zh-CN", "zh-Hans-CN", "wuu-Hans-CN", "yue-Hans-CN"],
    ),
    (
      "zh-Hant",
      vec![
        "zh-TW",
        "zh-HK",
        "zh-MO",
        "zh-Hant-TW",
        "zh-Hant-HK",
        "zh-Hant-MO",
        "yue-Hant-CN",
      ],
    ),
  ];

  language_map
    .iter()
    .find(|(_, locales)| locales.contains(&locale.as_str()))
    .map(|(mapped, _)| mapped.to_string())
    .unwrap_or_else(|| "en".to_string()) // fallback to "en"
}
