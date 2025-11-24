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

  let (results, mut servers): (
    Vec<(ServerInfo, Result<ServerStatus, McError>)>,
    Vec<GameServerInfo>,
  ) = async_runtime::spawn_blocking(move || {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let results = rt.block_on(async {
      let client = McClient::new()
        .with_timeout(Duration::from_secs(5))
        .with_max_parallel(10);

      let server_infos: Vec<ServerInfo> = servers
        .iter()
        .map(|sv| ServerInfo {
          address: sv.ip.clone(),
          edition: ServerEdition::Java,
        })
        .collect();

      client.ping_many(&server_infos).await
    });
    (results, servers)
  })
  .await?;

  for ((_, result), server) in results.into_iter().zip(servers.iter_mut()) {
    server.is_queried = true;

    if let ServerData::Java(sv) = result?.data {
      server.online = true;
      server.players_online = sv.players.online as usize;
      server.players_max = sv.players.max as usize;
      server.description = sv.description.clone();

      if let Some(favicon) = sv.favicon {
        server.icon_src = favicon;
      }
    }
  }

  Ok(servers)
}
