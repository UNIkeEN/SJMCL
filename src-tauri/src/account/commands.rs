use super::{
  constants::TEXTURE_ROLES,
  helpers::{
    authlib_injector::{info::fetch_auth_server, oauth, password},
    offline,
  },
  models::{AccountError, AccountInfo, AuthServer, Player},
};
use crate::{error::SJMCLResult, storage::Storage};
use tauri::AppHandle;
use uuid::Uuid;

#[tauri::command]
pub fn retrieve_player_list() -> SJMCLResult<Vec<Player>> {
  let state: AccountInfo = Storage::load().unwrap_or_default();
  let player_list: Vec<Player> = state.players.into_iter().map(Player::from).collect();
  Ok(player_list)
}

#[tauri::command]
pub fn retrieve_selected_player() -> SJMCLResult<Player> {
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
pub async fn add_player_offline(app: AppHandle, username: String) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();

  let new_player = offline::login(app, username).await?;

  if state
    .players
    .iter()
    .any(|player| player.uuid.to_string() == new_player.uuid.to_string())
  {
    return Err(AccountError::Duplicate.into());
  }

  state.selected_player_id = new_player.uuid.to_string();

  state.players.push(new_player);
  state.save()?;
  Ok(())
}

#[tauri::command]
pub async fn add_player_3rdparty_oauth(
  app: AppHandle,
  auth_server_url: String,
  openid_configuration_url: String,
) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();
  let new_player = oauth::login(app, auth_server_url, openid_configuration_url).await?;

  if state
    .players
    .iter()
    .any(|player| player.uuid.to_string() == new_player.uuid.to_string())
  {
    return Err(AccountError::Duplicate.into());
  }

  state.selected_player_id = new_player.uuid.to_string();

  state.players.push(new_player);
  state.save()?;
  Ok(())
}

#[tauri::command]
pub async fn add_player_3rdparty_password(
  auth_server_url: String,
  username: String,
  password: String,
) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();
  let new_players = password::login(auth_server_url, username, password).await?;

  if new_players.is_empty() {
    return Err(AccountError::NotFound.into());
  }

  if new_players.len() == 1 {
    state.selected_player_id = new_players[0].uuid.to_string();
  }

  let players_len_before = state.players.len();

  for new_player in new_players {
    if state
      .players
      .iter()
      .any(|player| player.uuid.to_string() == new_player.uuid.to_string())
    {
      // if some of the players have already been added, skip and try others
      continue;
    }

    state.players.push(new_player);
  }

  if players_len_before == state.players.len() {
    // raise duplicate error only if all players are duplicated
    return Err(AccountError::Duplicate.into());
  }

  state.save()?;

  Ok(())
}

#[tauri::command]
pub fn update_player_skin_offline_preset(
  app: AppHandle,
  uuid: Uuid,
  preset_role: String,
) -> SJMCLResult<()> {
  let mut state: AccountInfo = Storage::load().unwrap_or_default();

  let player = state
    .players
    .iter_mut()
    .find(|player| player.uuid.to_string() == uuid.to_string())
    .ok_or(AccountError::NotFound)?;

  if player.player_type != "offline" {
    return Err(AccountError::Invalid.into());
  }

  if TEXTURE_ROLES.contains(&preset_role.as_str()) {
    player.textures = offline::load_preset_skin(app, preset_role)?;
  } else {
    return Err(AccountError::TextureError.into());
  }

  state.save()?;

  Ok(())
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
pub fn retrieve_auth_server_list() -> SJMCLResult<Vec<AuthServer>> {
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
