use super::{
  helpers::fetch_auth_server,
  models::{AccountInfo, AuthServer, AuthServerError, Player, PlayerInfo},
};
use crate::{
  error::{SJMCLError, SJMCLResult},
  storage::Storage,
};
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
      // use the default steve skin (maybe the wrong way, need help)
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
    // first time launch the app, add some default auth servers
    let sjmc_auth_server = AuthServer {
      name: "SJMC 用户中心".to_string(),
      auth_url: "https://skin.mc.sjtu.cn/api/yggdrasil".to_string(),
      homepage_url: "https://skin.mc.sjtu.cn".to_string(),
      register_url: "https://skin.mc.sjtu.cn/auth/register".to_string(),
    };
    let mua_auth_server = AuthServer {
      name: "MUA 用户中心".to_string(),
      auth_url: "https://skin.mualliance.ltd/api/yggdrasil".to_string(),
      homepage_url: "https://skin.mualliance.ltd".to_string(),
      register_url: "https://skin.mualliance.ltd/auth/register".to_string(),
    };
    state.auth_servers.push(sjmc_auth_server);
    state.auth_servers.push(mua_auth_server);

    state.save()?;
  }

  Ok(state.auth_servers)
}

#[tauri::command]
pub async fn get_auth_server_info(mut url: String) -> SJMCLResult<AuthServer> {
  // check the url integrity following the standard
  // https://github.com/yushijinhun/authlib-injector/wiki/%E5%90%AF%E5%8A%A8%E5%99%A8%E6%8A%80%E6%9C%AF%E8%A7%84%E8%8C%83#%E5%9C%A8%E5%90%AF%E5%8A%A8%E5%99%A8%E4%B8%AD%E8%BE%93%E5%85%A5%E5%9C%B0%E5%9D%80
  if !url.starts_with("http://") && !url.starts_with("https://") {
    url = format!("https://{}", url);
  }
  if !url.ends_with("/api/yggdrasil") && !url.ends_with("/api/yggdrasil/") {
    url = format!("{}/api/yggdrasil", url);
  }

  let state: AccountInfo = Storage::load().unwrap_or_default();

  if state
    .auth_servers
    .iter()
    .any(|server| server.auth_url == url)
  {
    return Err(SJMCLError(AuthServerError::DuplicateServer.to_string()));
  }

  fetch_auth_server(url).await
}

#[tauri::command]
pub async fn add_auth_server(auth_url: String) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();
  if state.auth_servers.iter().any(|s| s.auth_url == auth_url) {
    // we need to strictly ensure the uniqueness of the url
    return Err(SJMCLError(AuthServerError::DuplicateServer.to_string()));
  }
  let server = fetch_auth_server(auth_url).await?;
  state.auth_servers.push(server);
  state.save()?;
  Ok(())
}

#[tauri::command]
pub fn delete_auth_server(url: String) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();

  let initial_len = state.auth_servers.len();
  // try to remove the server from the storage
  state.auth_servers.retain(|server| server.auth_url != url);
  if state.auth_servers.len() == initial_len {
    return Err(SJMCLError(AuthServerError::NotFound.to_string()));
  }

  // remove all players using this server
  state.players.retain(|player| player.auth_server_url != url);

  state.save()?;
  Ok(())
}
