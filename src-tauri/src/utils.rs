use serde_json::json;
use tauri_plugin_http::reqwest;

pub async fn send_statistics(version: String, os: String) -> Result<(), ()> {
  let url = "https://mc.sjtu.cn/api-sjmcl/statistics";
  let data = json!({
    "version": version,
    "os": os,
  });

  let client = reqwest::Client::new();
  if client.post(url).json(&data).send().await.is_ok() {}
  Ok(())
}
