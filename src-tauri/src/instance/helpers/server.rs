use lite_mc_ping::{PingOptions, PingResult, ServerAddress};
use quartz_nbt::io::Flavor;
use serde::{self, Deserialize, Serialize};
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use crate::instance::helpers::misc::get_instance_subdir_path_by_id;
use crate::instance::models::misc::InstanceSubdirType;

pub const SERVERS_DAT_FILENAME: &str = "servers.dat";

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
  pub latency: Option<u64>, // ping latency in milliseconds
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

impl From<GameServerInfo> for NbtServerInfo {
  fn from(server: GameServerInfo) -> Self {
    Self {
      ip: server.ip,
      icon: (!server.icon_src.is_empty()).then_some(server.icon_src),
      name: server.name,
      hidden: server.hidden,
    }
  }
}

impl From<&GameServerInfo> for NbtServerInfo {
  fn from(server: &GameServerInfo) -> Self {
    Self {
      ip: server.ip.clone(),
      icon: (!server.icon_src.is_empty()).then_some(server.icon_src.clone()),
      name: server.name.clone(),
      hidden: server.hidden,
    }
  }
}

pub fn get_servers_nbt_path_by_instance_id(
  app: &AppHandle,
  instance_id: &String,
) -> Option<PathBuf> {
  let game_root_dir = get_instance_subdir_path_by_id(app, instance_id, &InstanceSubdirType::Root)?;
  Some(game_root_dir.join(SERVERS_DAT_FILENAME))
}

pub async fn load_servers_info_from_nbt(path: &Path) -> SJMCLResult<Vec<GameServerInfo>> {
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

pub async fn save_servers_to_nbt(path: &Path, servers: &[GameServerInfo]) -> SJMCLResult<()> {
  let servers_info = NbtServersInfo {
    servers: servers.iter().map(NbtServerInfo::from).collect(),
  };
  let bytes = quartz_nbt::serde::serialize(&servers_info, None, Flavor::Uncompressed)?;
  tokio::fs::write(path, bytes).await?;

  Ok(())
}

pub async fn query_servers_online(
  servers: Vec<GameServerInfo>,
) -> SJMCLResult<Vec<GameServerInfo>> {
  if servers.is_empty() {
    return Ok(servers);
  }

  const MAX_PARALLEL: usize = 10;
  let sem = Arc::new(Semaphore::new(MAX_PARALLEL));
  let options = Arc::new(PingOptions {
    measure_latency: true,
    use_srv: true,
    ..PingOptions::default()
  });

  let mut set: JoinSet<(usize, ServerAddress, SJMCLResult<PingResult>)> = JoinSet::new();

  for (idx, sv) in servers.iter().enumerate() {
    let address = match sv.ip.parse::<ServerAddress>() {
      Ok(a) => a,
      Err(_) => continue,
    };
    let sem = sem.clone();
    let options = options.clone();
    let address_clone = address.clone();

    set.spawn(async move {
      if let Ok(_) = sem.acquire_owned().await {
        let result = lite_mc_ping::ping(&address_clone, &options)
          .await
          .map_err(|_| SJMCLError("Can not resolve ping action".to_string()));
        (idx, address_clone, result)
      } else {
        (
          idx,
          address_clone,
          Err(SJMCLError("Semaphore error".to_string())),
        )
      }
    });
  }

  let mut servers = servers;
  while let Some(joined) = set.join_next().await {
    let Ok((idx, _addr, result)) = joined else {
      continue;
    };
    servers[idx].is_queried = true;
    if let Ok(info) = result {
      servers[idx].online = true;
      servers[idx].latency = info.latency.map(|x| x.as_millis() as u64);
      servers[idx].players_online = info.status.players.online as usize;
      servers[idx].players_max = info.status.players.max as usize;
      servers[idx].description = info.status.description.as_str().unwrap_or("").to_string();
      if let Some(ico) = info.status.favicon {
        servers[idx].icon_src = ico;
      }
    }
  }

  Ok(servers)
}
