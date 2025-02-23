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
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PostSummary {
  pub title: String,
  pub abstracts: String,
  pub keywords: String,
  pub image_src: String,
  pub source: PostSourceInfo,
  pub update_at: String, // ISO Datetime String
  pub link: String,
}
