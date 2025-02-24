use crate::error::{SJMCLError, SJMCLResult};
use quartz_nbt::{NbtCompound, NbtList};
use serde::{self, Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct NbtServerInfo {
  pub ip: String,
  pub icon: String,
  pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct NbtServersInfo {
  pub servers: Vec<NbtServerInfo>,
}

pub fn nbt_to_servers_info(nbt: &NbtCompound) -> SJMCLResult<Vec<(String, String, String)>> {
  // return vec of (ip, name, icon_src)
  match nbt.get::<_, &NbtList>("servers") {
    Ok(servers) => {
      let mut servers_list = Vec::new();
      for server_idx in 0..servers.len() {
        if let Ok(server) = servers.get::<&NbtCompound>(server_idx) {
          match server.get::<_, &str>("ip") {
            Ok(ip) => {
              let icon = server.get::<_, &str>("icon").unwrap_or("");
              let name = server.get::<_, &str>("name").unwrap_or("unknown");
              servers_list.push((ip.to_string(), name.to_string(), icon.to_string()));
            }
            Err(_) => {
              continue;
            }
          }
        }
      }
      Ok(servers_list)
    }
    Err(e) => Err(SJMCLError::from(e)),
  }
}

// TODO: remove misc/fetch_url(), merge fetch and json process to query_server_info_online() here.
