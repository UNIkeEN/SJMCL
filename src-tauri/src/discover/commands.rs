use super::models::PostSourceInfo;
use crate::{
  discover::models::{PostResponse, PostSummary},
  error::SJMCLResult,
  launcher_config::models::LauncherConfig,
};
use futures::{
  future,
  stream::{self, StreamExt},
};
use reqwest::StatusCode;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use tokio::time::{sleep, timeout, Duration};

#[tauri::command]
pub async fn fetch_post_sources_info(app: AppHandle) -> SJMCLResult<Vec<PostSourceInfo>> {
  let post_source_urls = {
    let binding = app.state::<Mutex<LauncherConfig>>();
    let state = binding.lock().unwrap();
    state.discover_source_endpoints.clone()
  };

  let client = app.state::<reqwest::Client>();

  let results = stream::iter(post_source_urls.into_iter())
    .map(|url| {
      let client = client.clone();
      async move {
        sleep(Duration::from_millis(300)).await;

        let mut post_source = PostSourceInfo {
          name: "".to_string(),
          full_name: "".to_string(),
          endpoint_url: url.clone(),
          icon_src: "".to_string(),
        };

        let resp = timeout(Duration::from_secs(10), async {
          let mut tries = 0;
          loop {
            tries += 1;
            let response = client.get(&url).query(&[("pageSize", "0")]).send().await;

            match response {
              Ok(resp) if resp.status() == StatusCode::OK => return Ok(resp),
              Ok(resp) if resp.status() == StatusCode::SERVICE_UNAVAILABLE && tries < 3 => {
                sleep(Duration::from_secs(tries * 2)).await;
              }
              Ok(resp) => return Ok(resp),
              Err(_e) if tries < 3 => {
                sleep(Duration::from_secs(tries * 2)).await;
              }
              Err(e) => return Err(e),
            }
          }
        })
        .await;

        match resp {
          Ok(Ok(response)) => {
            let json_data: serde_json::Value = response.json().await.unwrap_or_default();
            if let Some(source_info) = json_data.get("sourceInfo") {
              post_source.name = source_info["name"].as_str().unwrap_or("").to_string();
              post_source.full_name = source_info["fullName"].as_str().unwrap_or("").to_string();
              post_source.icon_src = source_info["iconSrc"].as_str().unwrap_or("").to_string();
            }
          }
          Ok(Err(e)) => eprintln!("[fetch error] network error {}: {}", url, e),
          Err(_) => eprintln!("[fetch error] timeout {}", url),
        }

        post_source
      }
    })
    .buffer_unordered(1) // 单并发避免压垮服务器
    .collect::<Vec<_>>()
    .await;

  Ok(results)
}

#[tauri::command]
pub async fn fetch_post_summaries(app: AppHandle) -> SJMCLResult<Vec<PostSummary>> {
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
          if let Ok(post_list) = response.json::<PostResponse>().await {
            posts_vec = post_list.posts;
            posts_vec.sort_by(|a, b| b.update_at.cmp(&a.update_at));
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
