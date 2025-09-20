use crate::{error::SJMCLResult, launcher_config::models::LauncherConfigError};
use serde::Deserialize;
use tauri_plugin_http::reqwest;

#[derive(Debug, Deserialize)]
struct ReleaseMetaInfo {
  files: Vec<ReleaseArtifactItem>,
  version: String,
}

#[derive(Debug, Deserialize)]
struct ReleaseArtifactItem {
  name: String,
  size: u64,
}

pub async fn fetch_latest_version(client: &reqwest::Client) -> SJMCLResult<Option<String>> {
  // First, try to fetch from jCloud.
  if let Ok(resp) = client
    .get("https://mc.sjtu.cn/api-sjmcl/releases/latest")
    .send()
    .await
  {
    let parsed: Result<ReleaseMetaInfo, _> = resp.json().await;
    if let Ok(release) = parsed {
      return Ok(Some(release.version));
    }
  };

  // Second, fallback to GitHub.
  let resp = client
    .get("https://api.github.com/repos/UNIkeEN/SJMCL/releases/latest")
    .send()
    .await
    .map_err(|_| LauncherConfigError::FetchError)?;

  let json: serde_json::Value = resp
    .json()
    .await
    .map_err(|_| LauncherConfigError::ParseError)?;

  let version = json
    .get("tag_name")
    .and_then(|t| t.as_str())
    .map(|tag| tag.trim_start_matches('v').to_string())
    .ok_or(LauncherConfigError::ParseError)?;

  Ok(Some(version))
}
