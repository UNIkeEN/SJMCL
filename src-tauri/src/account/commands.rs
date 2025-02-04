use super::{
  helpers::fetch_auth_server,
  models::{AccountError, AccountInfo, AuthServer, Player, PlayerInfo},
};
use crate::{error::SJMCLResult, storage::Storage};
use uuid::Uuid;

#[tauri::command]
pub fn retrive_player_list() -> SJMCLResult<Vec<Player>> {
  let state: AccountInfo = Storage::load().unwrap_or_default();
  let player_list: Vec<Player> = state
    .players
    .into_iter()
    .map(|player_info| Player::from(player_info))
    .collect();
  Ok(player_list)
}

#[tauri::command]
pub fn retrive_selected_player() -> SJMCLResult<Player> {
  let state: AccountInfo = Storage::load().unwrap_or_default();
  if state.selected_player_id.is_empty() {
    return Err(AccountError::NotFound.into());
  }
  let player_info = state
    .players
    .iter()
    .find(|player| player.uuid.to_string() == state.selected_player_id)
    .cloned()
    .ok_or(AccountError::NotFound)?;
  Ok(Player::from(player_info))
}

#[tauri::command]
pub fn update_selected_player(uuid: Uuid) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();
  if state.players.iter().any(|player| player.uuid == uuid) {
    state.selected_player_id = uuid.to_string();
    state.save()?;
    Ok(())
  } else {
    Err(AccountError::NotFound.into())
  }
}

#[tauri::command]
pub async fn add_player(
  player_type: String,
  username: String,
  password: String,
  auth_server_url: String,
) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();

  let uuid = Uuid::new_v4();
  match player_type.as_str() {
    "offline" => {
      let player = PlayerInfo {
        name: username,
        uuid,
        player_type,
        // this url for avatar_src is a mock.
        avatar_src: "https://littleskin.cn/avatar/0?size=72&png=1".to_string(),
        auth_account: "".to_string(),
        password: "".to_string(),
        auth_server_url: "".to_string(),
      };

      state.selected_player_id = uuid.to_string();
      state.players.push(player);
      state.save()?;
      Ok(())
    }
    "microsoft" => {
      let player = PlayerInfo {
        name: username,
        uuid,
        player_type,
        // this url for avatar_src is a mock.
        avatar_src: "https://littleskin.cn/avatar/0?size=72&png=1".to_string(),
        auth_account: "".to_string(),
        password: "".to_string(),
        auth_server_url: "".to_string(),
      };

      state.selected_player_id = uuid.to_string();
      state.players.push(player);
      state.save()?;
      Ok(())
    }
    "3rdparty" => {
      // todo: real login
      let player = PlayerInfo {
        name: "Player".to_string(), // mock name
        uuid,
        player_type,
        avatar_src: "https://littleskin.cn/avatar/0?size=72&png=1".to_string(),
        auth_account: username,
        password,
        auth_server_url,
      };

      state.selected_player_id = uuid.to_string();
      state.players.push(player);
      state.save()?;
      Ok(())
    }
    _ => Err(AccountError::Invalid.into()),
  }
}

#[tauri::command]
pub fn delete_player(uuid: Uuid) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();

  if state.selected_player_id == uuid.to_string() {
    state.selected_player_id = "".to_string();
  }

  let initial_len = state.players.len();
  state.players.retain(|s| s.uuid != uuid);
  if state.players.len() == initial_len {
    return Err(AccountError::NotFound.into());
  }
  state.save()?;
  Ok(())
}

#[tauri::command]
pub fn retrive_auth_server_list() -> SJMCLResult<Vec<AuthServer>> {
  let state: AccountInfo = Storage::load().unwrap_or_default();
  Ok(state.auth_servers)
}

#[tauri::command]
pub async fn fetch_auth_server_info(mut url: String) -> SJMCLResult<AuthServer> {
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
    return Err(AccountError::Duplicate.into());
  }

  fetch_auth_server(url).await
}

#[tauri::command]
pub async fn add_auth_server(auth_url: String) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();
  if state.auth_servers.iter().any(|s| s.auth_url == auth_url) {
    // we need to strictly ensure the uniqueness of the url
    return Err(AccountError::Duplicate.into());
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
    return Err(AccountError::NotFound.into());
  }

  // remove all players using this server & check if the selected player is using this server
  state.players.retain(|player| {
    if player.uuid.to_string() == state.selected_player_id && player.auth_server_url == url {
      state.selected_player_id = "".to_string();
    }
    player.auth_server_url != url
  });

  state.save()?;
  Ok(())
}
