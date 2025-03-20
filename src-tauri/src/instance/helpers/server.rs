use crate::error::{SJMCLError, SJMCLResult};
use quartz_nbt::io::Flavor;
use serde::{self, Deserialize, Serialize};
use std::path::Path;
use tauri_plugin_http::reqwest;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct NbtServerInfo {
  pub ip: String,
  pub icon: Option<String>,
  pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct NbtServersInfo {
  pub servers: Vec<NbtServerInfo>,
}

pub async fn load_servers_info_from_path(path: &Path) -> SJMCLResult<Vec<NbtServerInfo>> {
  if !path.exists() {
    return Ok(Vec::new());
  }
  let bytes = tokio::fs::read(path).await?;
  let (servers_info, _snbt) =
    quartz_nbt::serde::deserialize::<NbtServersInfo>(&bytes, Flavor::Uncompressed)?;
  Ok(servers_info.servers)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SjmcServerQueryResult {
  pub online: bool,
  pub players: Players,
  pub favicon: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Players {
  pub online: u64,
  pub max: u64,
}

pub async fn query_server_status(server: &String) -> SJMCLResult<SjmcServerQueryResult> {
  // construct request url
  let url = format!("https://mc.sjtu.cn/custom/serverlist/?query={}", server);
  let response = reqwest::get(&url).await?;
  if !response.status().is_success() {
    return Err(SJMCLError(format!("http error: {}", response.status())));
  }
  let query_result: SjmcServerQueryResult = response.json().await?;
  Ok(query_result)
}
