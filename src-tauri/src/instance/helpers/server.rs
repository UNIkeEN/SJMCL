use mc_server_status::{McClient, ServerData, ServerStatus};
use quartz_nbt::io::Flavor;
use serde::{self, Deserialize, Serialize};
use sjmcl_types::error::SJMCLResult;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::async_runtime;
use tauri::{AppHandle, Emitter};

use crate::instance::helpers::misc::get_instance_subdir_path_by_id;
use crate::instance::models::misc::InstanceSubdirType;

pub const SERVERS_DAT_FILENAME: &str = "servers.dat";
/// Emitted for each finished ping so the UI can render results progressively.
pub const GAME_SERVER_STATUS_EVENT: &str = "instance:game-server-status";

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
  // position in servers.dat; used for delete/reorder (vanilla allows duplicate IPs)
  pub index: usize,
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
    let icon = normalize_icon_for_nbt(&server.icon_src);
    Self {
      ip: server.ip,
      icon: (!icon.is_empty()).then_some(icon),
      name: server.name,
      hidden: server.hidden,
    }
  }
}

impl From<&GameServerInfo> for NbtServerInfo {
  fn from(server: &GameServerInfo) -> Self {
    let icon = normalize_icon_for_nbt(&server.icon_src);
    Self {
      ip: server.ip.clone(),
      icon: (!icon.is_empty()).then_some(icon),
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

/// Attach servers.dat indexes and drop hidden rows (same filter as vanilla multiplayer UI).
pub fn to_visible_servers_with_index(servers: Vec<GameServerInfo>) -> Vec<GameServerInfo> {
  servers
    .into_iter()
    .enumerate()
    .map(|(i, mut server)| {
      server.index = i;
      server
    })
    .filter(|server| !server.hidden)
    .collect()
}

/// Ping Java servers in parallel via `mc-server-status`. Emits `GAME_SERVER_STATUS_EVENT`
/// as each unique address finishes.
pub async fn query_servers_online(
  servers: Vec<GameServerInfo>,
  app: Option<AppHandle>,
) -> SJMCLResult<Vec<GameServerInfo>> {
  if servers.is_empty() {
    return Ok(servers);
  }

  use futures::stream::{self, StreamExt};
  use std::sync::{Arc, Mutex};

  let shared = Arc::new(Mutex::new(servers));
  let mut unique_addrs: Vec<String> = Vec::new();
  {
    let guard = shared.lock().unwrap();
    for s in guard.iter() {
      if !unique_addrs.iter().any(|a| a == &s.ip) {
        unique_addrs.push(s.ip.clone());
      }
    }
  }

  stream::iter(unique_addrs)
    .map(|addr| {
      let shared = Arc::clone(&shared);
      let app = app.clone();
      async move {
        let addr_for_ping = addr.clone();
        let ping_result = async_runtime::spawn_blocking(move || {
          let rt = tokio::runtime::Runtime::new().unwrap();
          rt.block_on(async {
            let client = McClient::new()
              .with_timeout(Duration::from_secs(5))
              .with_max_parallel(1);
            client.ping_java(&addr_for_ping).await
          })
        })
        .await;

        let status = match ping_result {
          Ok(Ok(status)) => Some(status),
          _ => None,
        };

        let mut guard = shared.lock().unwrap();
        for server in guard.iter_mut() {
          if server.ip != addr {
            continue;
          }
          match &status {
            Some(st) => apply_crate_status(server, st),
            None => mark_offline(server),
          }
          if let Some(app) = &app {
            let _ = app.emit(GAME_SERVER_STATUS_EVENT, &*server);
          }
        }
      }
    })
    .buffer_unordered(10)
    .collect::<Vec<()>>()
    .await;

  let servers = Arc::try_unwrap(shared)
    .map(|m| m.into_inner().unwrap())
    .unwrap_or_else(|arc| arc.lock().unwrap().clone());

  Ok(servers)
}

/// Strip `data:image/png;base64,` (or similar) so vanilla-compatible NBT stores raw base64.
pub fn normalize_icon_for_nbt(icon: &str) -> String {
  let icon = icon.trim();
  if icon.is_empty() {
    return String::new();
  }
  if let Some(idx) = icon.find(";base64,") {
    return icon[idx + ";base64,".len()..].to_string();
  }
  icon.to_string()
}

/// Persist ping-fetched icons into servers.dat (vanilla multiplayer also caches icons there).
pub async fn persist_server_icons_to_nbt(
  path: &Path,
  queried: &[GameServerInfo],
) -> SJMCLResult<()> {
  if queried.is_empty() {
    return Ok(());
  }
  let mut existing = load_servers_info_from_nbt(path).await?;
  let mut changed = false;
  for server in queried {
    if server.icon_src.is_empty() {
      continue;
    }
    let Some(entry) = existing.get_mut(server.index) else {
      continue;
    };
    let normalized = normalize_icon_for_nbt(&server.icon_src);
    if normalized.is_empty() {
      continue;
    }
    if normalize_icon_for_nbt(&entry.icon_src) != normalized {
      entry.icon_src = server.icon_src.clone();
      changed = true;
    }
  }
  if changed {
    save_servers_to_nbt(path, &existing).await?;
  }
  Ok(())
}

fn mark_offline(server: &mut GameServerInfo) {
  server.is_queried = true;
  server.online = false;
  server.latency = None;
  server.players_online = 0;
  server.players_max = 0;
}

fn apply_crate_status(server: &mut GameServerInfo, status: &ServerStatus) {
  server.is_queried = true;
  if let ServerData::Java(sv) = &status.data {
    server.online = true;
    server.latency = Some(status.latency.round() as u64);
    server.players_online = sv.players.online as usize;
    server.players_max = sv.players.max as usize;
    server.description = sv.description.clone();
    if let Some(favicon) = &sv.favicon {
      server.icon_src = favicon.clone();
    }
  } else {
    mark_offline(server);
  }
}
