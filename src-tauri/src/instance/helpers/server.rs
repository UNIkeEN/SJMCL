use crate::error::{SJMCLError, SJMCLResult};
use quartz_nbt::{NbtCompound, NbtList};
use serde::{self, Deserialize, Serialize};
use tauri_plugin_http::reqwest;

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
  // 构建请求URL
  let url = format!("https://mc.sjtu.cn/custom/serverlist/?query={}", server);
  let response = reqwest::get(&url).await?;
  if !response.status().is_success() {
    return Err(SJMCLError(format!("http error: {}", response.status())));
  }
  let query_result: SjmcServerQueryResult = response.json().await?;
  Ok(query_result)
}
