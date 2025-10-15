use crate::error::SJMCLResult;
use quartz_nbt::io::Flavor;
use serde::{self, Deserialize, Serialize};
use std::path::Path;

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
pub struct GameServerInfo {
  pub ip: String,
  pub name: String,
  pub description: String,
  pub icon_src: String,
  pub is_queried: bool,
  pub players_max: usize,
  pub players_online: usize,
  pub online: bool,
}
