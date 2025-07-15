use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PostSourceInfo {
  pub name: String,
  pub full_name: String,
  pub endpoint_url: String,
  pub icon_src: String,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PostSummary {
  pub title: String,
  #[serde(rename = "abstract")]
  pub abstracts: String,
  pub keywords: String,
  pub image_src: (String, u64, u64),
  pub source: PostSourceInfo,
  pub update_at: String, // ISO Datetime String
  pub link: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostResponse {
  pub posts: Vec<PostSummary>,
  pub next: Option<u64>,
  pub cursors: Option<HashMap<String, u64>>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostRequest {
  pub url: String,
  pub cursor: Option<u64>,
}
