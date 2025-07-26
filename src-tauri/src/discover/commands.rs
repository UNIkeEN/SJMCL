use super::super::utils::web::with_retry;
use super::models::NewsSourceInfo;
use crate::{
  discover::models::{NewsPostRequest, NewsPostResponse},
  error::SJMCLResult,
  launcher_config::models::LauncherConfig,
};
use futures::future;
use std::{collections::HashMap, sync::Mutex};
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

#[tauri::command]
pub async fn fetch_news_sources_info(app: AppHandle) -> SJMCLResult<Vec<NewsSourceInfo>> {
  let post_source_urls = {
    let binding = app.state::<Mutex<LauncherConfig>>();
    let state = binding.lock().unwrap();
    state.discover_source_endpoints.clone()
  };

  let client = with_retry(app.state::<reqwest::Client>().inner().clone());

  let tasks: Vec<_> = post_source_urls
    .into_iter()
    .map(|url| {
      let client = client.clone();
      async move {
        let mut news_source = NewsSourceInfo {
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
            news_source.name = source_info["name"].as_str().unwrap_or("").to_string();
            news_source.full_name = source_info["fullName"].as_str().unwrap_or("").to_string();
            news_source.icon_src = source_info["iconSrc"].as_str().unwrap_or("").to_string();
          }
        }

        news_source
      }
    })
    .collect();

  Ok(future::join_all(tasks).await)
}

#[tauri::command]
pub async fn fetch_news_post_summaries(
  app: AppHandle,
  requests: Vec<NewsPostRequest>,
) -> SJMCLResult<NewsPostResponse> {
  let client = with_retry(app.state::<reqwest::Client>().inner().clone());
  let tasks: Vec<_> = requests
    .into_iter()
    .map(|NewsPostRequest { url, cursor }| {
      let client = client.clone();
      async move {
        let mut req = client.get(&url).query(&[("pageSize", "12")]);

        if let Some(c) = cursor {
          req = req.query(&[("cursor", &c.to_string())]);
        }

        let resp = req.send().await;
        match resp {
          Ok(resp) if resp.status().is_success() => {
            let parsed: Result<NewsPostResponse, _> = resp.json().await;
            parsed.ok().map(|mut p| {
              for post in &mut p.posts {
                post.source.endpoint_url = url.clone();
              }
              (url.clone(), p)
            })
          }
          _ => None,
        }
      }
    })
    .collect();

  let results = futures::future::join_all(tasks).await;

  let mut all_posts = Vec::new();
  let mut cursors_map = HashMap::new();

  for result in results.into_iter().flatten() {
    let (url, post_response) = result;
    all_posts.extend(post_response.posts);
    if let Some(next_cursor) = post_response.next {
      cursors_map.insert(url, next_cursor);
    }
  }

  all_posts.sort_by(|a, b| b.create_at.cmp(&a.create_at));

  Ok(NewsPostResponse {
    posts: all_posts,
    next: None,
    cursors: Some(cursors_map),
  })
}
