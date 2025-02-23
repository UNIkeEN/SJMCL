use super::models::PostSourceInfo;
use crate::{error::SJMCLResult, launcher_config::models::LauncherConfig};
use futures::future;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest::Client;

#[tauri::command]
pub async fn fetch_post_sources_info(app: AppHandle) -> SJMCLResult<Vec<PostSourceInfo>> {
  let post_source_urls = {
    let binding = app.state::<Mutex<LauncherConfig>>();
    let state = binding.lock().unwrap();
    state.discover_source_endpoints.clone()
  };

  let client = Client::new();

  let tasks: Vec<_> = post_source_urls
    .into_iter()
    .map(|url| {
      let client = client.clone();
      async move {
        let mut post_source = PostSourceInfo {
          name: "".to_string(),
          full_name: "".to_string(),
          endpoint_url: url.clone(),
          icon_src: "".to_string(),
        };

        let response = client
          .get(&url)
          .query(&[("pageSize", "0")]) // ?pageSize=0
          .send()
          .await;

        if let Ok(response) = response {
          let json_data: serde_json::Value = response.json().await.unwrap_or_default();

          if let Some(source_info) = json_data.get("sourceInfo") {
            post_source.name = source_info["name"].as_str().unwrap_or("").to_string();
            post_source.full_name = source_info["fullName"].as_str().unwrap_or("").to_string();
            post_source.icon_src = source_info["iconSrc"].as_str().unwrap_or("").to_string();
          }
        }

        post_source
      }
    })
    .collect();

  Ok(future::join_all(tasks).await)
}
