use super::models::GameServerInfo;
use crate::error::SJMCLResult;
use serde_json::Value;
use tauri_plugin_http::reqwest;

#[tauri::command]
pub async fn get_game_servers(
  instance_id: usize,
  query_online: bool,
) -> SJMCLResult<Vec<GameServerInfo>> {
  // query_online is false, return local data from nbt (servers.dat)
  // TODO: now use mock data
  let mut game_servers = vec![
    GameServerInfo {
        icon_src: "https://mc.sjtu.cn/wiki/images/8/8c/SMP2-server-icon.png".to_string(),
        ip: "smp2.sjmc.club".to_string(),
        name: "SJMC-SMP2.6".to_string(),
        is_queried: false,
        players_online: 0,
        players_max: 0,
        online: false,
    },
    GameServerInfo {
        icon_src: "https://zh.minecraft.wiki/images/thumb/Minecraft_Preview_icon_2.png/240px-Minecraft_Preview_icon_2.png".to_string(),
        ip: "smp3.sjmc.club".to_string(),
        name: "SJMC-SMP3(offline display test)".to_string(),
        is_queried: false,
        players_online: 0,
        players_max: 0,
        online: false,
    },
  ];

  // query_online is true, amend query and return player count and online status
  if query_online {
    for server in &mut game_servers {
      let url = format!("https://mc.sjtu.cn/custom/serverlist/?query={}", server.ip);
      match reqwest::get(&url).await {
        Ok(response) => {
          if response.status().is_success() {
            match response.json::<Value>().await {
              Ok(data) => {
                // manually parse the JSON into the required fields
                if let Some(players) = data["players"].as_object() {
                  if let Some(online) = players["online"].as_u64() {
                    server.players_online = online as usize;
                  }
                  if let Some(max) = players["max"].as_u64() {
                    server.players_max = max as usize;
                  }
                }
                if let Some(online) = data["online"].as_bool() {
                  server.online = online;
                }
                if let Some(favicon) = data["favicon"].as_str() {
                  server.icon_src = favicon.to_string();
                }
                server.is_queried = true;
              }
              Err(_) => {
                server.is_queried = false; // JSON parse error
              }
            }
          } else {
            server.is_queried = false; // request error
          }
        }
        Err(_) => {
          server.is_queried = false;
        }
      }
    }
  }

  Ok(game_servers)
}
