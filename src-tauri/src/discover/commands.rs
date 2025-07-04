use super::models::PostSourceInfo;
use crate::{
  discover::models::PostSummary, error::SJMCLResult, launcher_config::models::LauncherConfig,
};
use futures::future;
use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

#[tauri::command]
pub async fn fetch_post_sources_info(app: AppHandle) -> SJMCLResult<Vec<PostSourceInfo>> {
  let post_source_urls = {
    let binding = app.state::<Mutex<LauncherConfig>>();
    let state = binding.lock().unwrap();
    state.discover_source_endpoints.clone()
  };

  let client = app.state::<reqwest::Client>();

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

#[tauri::command]
pub async fn fetch_posts_summaries(app: AppHandle) -> SJMCLResult<Vec<PostSummary>> {
  let post_source_urls = {
    let binding = app.state::<Mutex<LauncherConfig>>();
    let state = binding.lock().unwrap();
    state.discover_source_endpoints.clone()
  };

  let client = app.state::<reqwest::Client>();

  let tasks: Vec<_> = post_source_urls
    .into_iter()
    .map(|url| {
      let client = client.clone();
      async move {
        let mut posts_vec = Vec::new();

        let response = client.get(&url).query(&[("pageSize", "12")]).send().await;

        if let Ok(response) = response {
          if let Ok(json_data) = response.json::<Value>().await {
            if let Some(posts) = json_data.get("posts").and_then(|p| p.as_array()) {
              for post_json in posts {
                let post = PostSummary {
                  title: post_json
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                  abstracts: post_json
                    .get("abstract")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                  keywords: post_json
                    .get("keywords")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                  image_src: post_json
                    .get("imageSrc")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                  update_at: post_json
                    .get("updateAt")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                  link: post_json
                    .get("link")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                  source: {
                    let mut source = PostSourceInfo {
                      endpoint_url: url.clone(),
                      name: "".to_string(),
                      full_name: "".to_string(),
                      icon_src: "".to_string(),
                    };
                    if let Some(source_info) = post_json.get("source") {
                      source.name = source_info
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                      source.full_name = source_info
                        .get("fullName")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                      source.icon_src = source_info
                        .get("iconSrc")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    }
                    source
                  },
                };
                posts_vec.push(post);
              }
              posts_vec.sort_by(|a, b| b.update_at.cmp(&a.update_at));
            }
          }
        }

        posts_vec
      }
    })
    .collect();

  let all_posts = future::join_all(tasks)
    .await
    .into_iter()
    .flatten()
    .collect();

  Ok(all_posts)
}
