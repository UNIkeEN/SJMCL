use crate::discover::models::{NewsPostResponse, NewsPostSummary, NewsSourceInfo};
use chrono::{DateTime, TimeZone, Utc};
use reqwest_middleware::ClientWithMiddleware;
use serde::Deserialize;

pub const MC_NEWS_ENDPOINT: &str = "https://net-secondary.web.minecraft-services.net/api/v1.0";
pub const MC_NEWS_DEFAULT_PAGE_SIZE: u32 = 12;

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct McNewsSearchResponse {
  pub result: Option<McNewsResult>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct McNewsResult {
  #[serde(default)]
  pub results: Vec<McNewsItem>,
  #[serde(default)]
  pub num_found: u32,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct McNewsItem {
  #[serde(default)]
  pub title: String,
  #[serde(default)]
  pub url: String,
  #[serde(default)]
  pub description: String,
  #[serde(default)]
  pub image: String,
  #[serde(default)]
  pub time: i64,
}

fn parse_mc_timestamp(ts: i64) -> String {
  let datetime: Option<DateTime<Utc>> = if ts > 10_000_000_000 {
    DateTime::<Utc>::from_timestamp_millis(ts)
  } else {
    Utc.timestamp_opt(ts, 0).single()
  };

  let datetime = datetime.unwrap_or_else(Utc::now);

  datetime.to_rfc3339()
}

fn mc_news_source_info(endpoint_url: String) -> NewsSourceInfo {
  NewsSourceInfo {
    name: "Minecraft.net".to_string(),
    full_name: "Minecraft Official News".to_string(),
    endpoint_url,
    icon_src:
      "https://www.minecraft.net/etc.clientlibs/minecraftnet/clientlibs/clientlib-site/resources/favicon.ico"
        .to_string(),
  }
}

impl From<(McNewsItem, NewsSourceInfo)> for NewsPostSummary {
  fn from((item, source): (McNewsItem, NewsSourceInfo)) -> Self {
    let image_src = if item.image.is_empty() {
      ("".to_string(), 0, 0)
    } else {
      // Keep original image ratio by not forcing dimensions; frontend will handle it
      (item.image, 0, 0)
    };

    NewsPostSummary {
      title: item.title,
      abstracts: item.description,
      keywords: String::new(),
      image_src,
      source,
      create_at: parse_mc_timestamp(item.time),
      link: item.url,
    }
  }
}

pub async fn fetch_mc_news_page(
  client: &ClientWithMiddleware,
  base_url: &str,
  cursor: Option<u64>,
) -> Option<(String, NewsPostResponse)> {
  let page = cursor.unwrap_or(1).max(1) as u32;
  let endpoint = format!("{}/zh-cn/search", base_url.trim_end_matches('/'));
  // Minecraft News doesn't differ among regions, so we just use zh-cn as default

  let response = client
    .get(&endpoint)
    .query(&[
      ("page", page.to_string()),
      ("pageSize", MC_NEWS_DEFAULT_PAGE_SIZE.to_string()),
      ("sortType", "Recent".to_string()),
      ("category", "News".to_string()),
      ("newsOnly", "true".to_string()),
    ])
    .send()
    .await
    .ok()?;

  if !response.status().is_success() {
    return None;
  }

  let body: McNewsSearchResponse = response.json().await.ok()?;
  let result = body.result.unwrap_or_default();
  let source_info = mc_news_source_info(base_url.to_string());

  let posts: Vec<NewsPostSummary> = result
    .results
    .into_iter()
    .map(|item| NewsPostSummary::from((item, source_info.clone())))
    .collect();

  let has_more = (page as u64 * MC_NEWS_DEFAULT_PAGE_SIZE as u64) < result.num_found as u64;

  Some((
    base_url.to_string(),
    NewsPostResponse {
      posts,
      next: if has_more {
        Some((page + 1) as u64)
      } else {
        None
      },
      cursors: None,
    },
  ))
}
