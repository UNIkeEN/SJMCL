use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NewsSourceInfo {
  pub name: String,
  pub full_name: String,
  pub endpoint_url: String,
  pub icon_src: String,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NewsPostSummary {
  pub title: String,
  #[serde(rename = "abstract")]
  pub abstracts: String,
  pub keywords: String,
  pub image_src: (String, u64, u64),
  pub source: NewsSourceInfo,
  pub create_at: String, // ISO Datetime String
  pub link: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsPostRequest {
  pub url: String,
  pub cursor: Option<u64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsPostResponse {
  pub posts: Vec<NewsPostSummary>,
  pub next: Option<u64>,
  pub cursors: Option<HashMap<String, u64>>,
}
