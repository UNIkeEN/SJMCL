use super::models::{AccountInfo, AuthServer, AuthServerError, Player, PlayerInfo};
use crate::{
  error::{SJMCLError, SJMCLResult},
  storage::Storage,
};
use tauri_plugin_http::reqwest;
use uuid::Uuid;

#[tauri::command]
pub fn get_players() -> SJMCLResult<Vec<Player>> {
  let state: AccountInfo = Storage::load().unwrap_or_default();
  let AccountInfo {
    players,
    auth_servers,
  } = state;
  let player_list: Vec<Player> = players
    .into_iter()
    .map(|player_info| {
      let auth_server = auth_servers
        .iter()
        .find(|server| server.auth_url == player_info.auth_server_url)
        .cloned()
        .unwrap_or_default();
      Player {
        uuid: player_info.uuid,
        name: player_info.name,
        player_type: player_info.player_type,
        auth_server,
        avatar_src: player_info.avatar_src,
        auth_account: player_info.auth_account,
        password: player_info.password,
      }
    })
    .collect();
  Ok(player_list)
}

#[tauri::command]
pub async fn add_player(mut player: PlayerInfo) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();

  let uuid = Uuid::new_v4();
  match player.player_type.as_str() {
    "offline" => {
      player.uuid = uuid.to_string();
      player.avatar_src = "https://littleskin.cn/avatar/0?size=72&png=1".to_string();

      state.players.push(player);
      state.save()?;
      Ok(())
    }
    "3rdparty" => {
      // todo: real login
      player.name = "Player".to_string();
      player.uuid = uuid.to_string();
      player.avatar_src = "https://littleskin.cn/avatar/0?size=72&png=1".to_string();

      state.players.push(player);
      state.save()?;
      Ok(())
    }
    _ => Err(SJMCLError("Unknown server type".to_string())),
  }
}

#[tauri::command]
pub fn delete_player(uuid: String) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();
  let initial_len = state.players.len();
  state.players.retain(|s| s.uuid != uuid);
  if state.players.len() == initial_len {
    return Err(SJMCLError("Player not found".to_string()));
  }
  state.save()?;
  Ok(())
}

#[tauri::command]
pub fn get_auth_servers() -> SJMCLResult<Vec<AuthServer>> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();

  if state.auth_servers.len() == 0 {
    let sjmc_auth_server = AuthServer {
      name: "SJMC 用户中心".to_string(),
      auth_url: "https://skin.mc.sjtu.cn/api/yggdrasil".to_string(),
      mutable: false,
    };
    let mua_auth_server = AuthServer {
      name: "MUA 用户中心".to_string(),
      auth_url: "https://skin.mualliance.ltd/api/yggdrasil".to_string(),
      mutable: false,
    };
    state.auth_servers.push(sjmc_auth_server);
    state.auth_servers.push(mua_auth_server);

    state.save()?;
  }

  Ok(state.auth_servers)
}

#[tauri::command]
pub async fn add_auth_server(mut url: String) -> SJMCLResult<AuthServer> {
  if !url.starts_with("http://") && !url.starts_with("https://") {
    url = format!("https://{}", url);
  }
  if !url.ends_with("/api/yggdrasil") && !url.ends_with("/api/yggdrasil/") {
    url = format!("{}/api/yggdrasil", url);
  }

  let mut state: AccountInfo = Storage::load().unwrap_or_default();

  if state
    .auth_servers
    .iter()
    .any(|server| server.auth_url == url)
  {
    return Err(SJMCLError(AuthServerError::DuplicateServer.to_string()));
  }
  match reqwest::get(&url).await {
    Ok(response) => {
      let json: serde_json::Value = response
        .json()
        .await
        .map_err(|_| SJMCLError(AuthServerError::InvalidServer.to_string()))?;
      let server_name = json["meta"]["serverName"]
        .as_str()
        .ok_or_else(|| SJMCLError(AuthServerError::InvalidServer.to_string()))?
        .to_string();

      let new_server = AuthServer {
        name: server_name,
        auth_url: url,
        mutable: true,
      };

      state.auth_servers.push(new_server.clone());

      state.save()?;

      Ok(new_server)
    }
    Err(_) => return Err(SJMCLError(AuthServerError::InvalidServer.to_string())),
  }
}

#[tauri::command]
pub fn delete_auth_server(url: String) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();
  let initial_len = state.auth_servers.len();
  state
    .auth_servers
    .retain(|server| server.auth_url != url || !server.mutable);
  if state.auth_servers.len() == initial_len {
    return Err(SJMCLError(AuthServerError::NotFound.to_string()));
  }
  state.save()?;
  Ok(())
}
