use crate::error::SJMCLResult;
use mc_server_status::{McClient, McError, ServerData, ServerEdition, ServerInfo, ServerStatus};
use quartz_nbt::io::Flavor;
use serde::{self, Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;
use tauri::async_runtime;

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GameServerInfo {
  pub icon_src: String,
  pub ip: String,
  pub name: String,
  pub hidden: bool,
  pub description: String,
  pub is_queried: bool, // if true, this is a complete result from a successful query
  pub players_online: usize,
  pub players_max: usize,
  pub online: bool, // if false, it may be offline in the query result or failed in the query.
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct NbtServerInfo {
  pub ip: String,
  pub icon: Option<String>,
  pub name: String,
  #[serde(default)]
  pub hidden: bool,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct NbtServersInfo {
  pub servers: Vec<NbtServerInfo>,
}

impl From<NbtServerInfo> for GameServerInfo {
  fn from(nbt: NbtServerInfo) -> Self {
    Self {
      ip: nbt.ip,
      name: nbt.name,
      icon_src: nbt.icon.unwrap_or_default(),
      hidden: nbt.hidden,
      ..Default::default()
    }
  }
}

pub async fn load_servers_info_from_path(path: &Path) -> SJMCLResult<Vec<GameServerInfo>> {
  if !path.exists() {
    return Ok(Vec::new());
  }
  let bytes = tokio::fs::read(path).await?;
  let (servers_info, _snbt) =
    quartz_nbt::serde::deserialize::<NbtServersInfo>(&bytes, Flavor::Uncompressed)?;
  let game_server_list = servers_info
    .servers
    .into_iter()
    .map(|nbt| nbt.into())
    .collect();

  Ok(game_server_list)
}

/// Query multiple servers online status in parallel.
pub async fn query_servers_online(
  mut servers: Vec<GameServerInfo>,
) -> SJMCLResult<Vec<GameServerInfo>> {
  if servers.is_empty() {
    return Ok(servers);
  }

  let servers_clone = servers.clone();

  let results: Vec<(ServerInfo, Result<ServerStatus, McError>)> =
    async_runtime::spawn_blocking(move || {
      let rt = tokio::runtime::Runtime::new().unwrap();
      rt.block_on(async {
        let client = McClient::new()
          .with_timeout(Duration::from_secs(5))
          .with_max_parallel(10);

        let server_infos: Vec<ServerInfo> = servers_clone
          .iter()
          .map(|sv| ServerInfo {
            address: sv.ip.clone(),
            edition: ServerEdition::Java,
          })
          .collect();

        client.ping_many(&server_infos).await
      })
    })
    .await?;

  for (info, result) in results.into_iter() {
    if let Some(server) = servers.iter_mut().find(|s| s.ip == info.address) {
      server.is_queried = true;

      if let Ok(status) = result {
        if let ServerData::Java(sv) = status.data {
          server.online = true;
          server.players_online = sv.players.online as usize;
          server.players_max = sv.players.max as usize;
          server.description = sv.description.clone();

          if let Some(favicon) = sv.favicon {
            server.icon_src = favicon;
          }
        }
      }
    }
  }

  Ok(servers)
}
