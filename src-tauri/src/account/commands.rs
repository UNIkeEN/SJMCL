use super::{
  constants::TEXTURE_ROLES,
  helpers::{
    authlib_injector::{
      info::{fetch_auth_server, fetch_auth_url},
      oauth, password,
    },
    offline,
  },
  models::{AccountError, AccountInfo, AuthServer, OAuthCodeResponse, Player, PlayerType},
};
use crate::{error::SJMCLResult, launcher_config::models::LauncherConfig, storage::Storage};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use url::Url;

#[tauri::command]
pub fn retrieve_player_list(app: AppHandle) -> SJMCLResult<Vec<Player>> {
  let binding = app.state::<Mutex<AccountInfo>>();
  let state = binding.lock()?;

  let player_list: Vec<Player> = state
    .clone()
    .players
    .into_iter()
    .map(Player::from)
    .collect();
  Ok(player_list)
}

#[tauri::command]
pub fn retrieve_selected_player(app: AppHandle) -> SJMCLResult<Player> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  let account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let config_state = config_binding.lock()?;

  if config_state.states.shared.selected_player_id.is_empty() {
    return Err(AccountError::NotFound.into());
  }
  let player_info = account_state
    .players
    .iter()
    .find(|player| player.gen_player_id() == config_state.states.shared.selected_player_id)
    .cloned()
    .ok_or(AccountError::NotFound)?;
  Ok(Player::from(player_info))
}

#[tauri::command]
pub fn update_selected_player(app: AppHandle, player_id: String) -> SJMCLResult<()> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  let account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;

  if account_state
    .players
    .iter()
    .any(|player| player.gen_player_id() == player_id)
  {
    config_state.states.shared.selected_player_id = player_id;
    config_state.save()?;
    Ok(())
  } else {
    Err(AccountError::NotFound.into())
  }
}

#[tauri::command]
pub async fn add_player_offline(app: AppHandle, username: String) -> SJMCLResult<()> {
  let new_player = offline::login(app.clone(), username).await?;

  let account_binding = app.state::<Mutex<AccountInfo>>();
  let mut account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;

  if account_state
    .players
    .iter()
    .any(|player| player.gen_player_id() == new_player.gen_player_id())
  {
    return Err(AccountError::Duplicate.into());
  }

  config_state.states.shared.selected_player_id = new_player.gen_player_id();

  account_state.players.push(new_player);
  account_state.save()?;
  Ok(())
}

#[tauri::command]
pub async fn fetch_oauth_code(
  app: AppHandle,
  server_type: PlayerType,
  auth_server_url: String,
) -> SJMCLResult<OAuthCodeResponse> {
  if server_type == PlayerType::ThirdParty {
    let binding = app.state::<Mutex<AccountInfo>>();

    let auth_server = {
      let state = binding.lock()?;
      state
        .auth_servers
        .iter()
        .find(|server| server.auth_url == auth_server_url)
        .ok_or(AccountError::NotFound)?
        .clone()
    };

    oauth::device_authorization(
      app.clone(),
      auth_server.features.openid_configuration_url,
      auth_server.client_id,
    )
    .await
  } else if server_type == PlayerType::Microsoft {
    todo!()
  } else {
    Err(AccountError::Invalid.into())
  }
}

#[tauri::command]
pub async fn add_player_oauth(
  app: AppHandle,
  server_type: PlayerType,
  auth_info: OAuthCodeResponse,
  auth_server_url: String,
) -> SJMCLResult<()> {
  let binding = app.state::<Mutex<AccountInfo>>();

  let new_player = if server_type == PlayerType::ThirdParty {
    let auth_server = {
      let state = binding.lock()?;
      state
        .auth_servers
        .iter()
        .find(|server| server.auth_url == auth_server_url)
        .ok_or(AccountError::NotFound)?
        .clone()
    };

    oauth::login(
      app.clone(),
      auth_server_url,
      auth_server.features.openid_configuration_url,
      auth_server.client_id,
      auth_info,
    )
    .await?
  } else if server_type == PlayerType::Microsoft {
    todo!()
  } else {
    return Err(AccountError::Invalid.into());
  };

  let account_binding = app.state::<Mutex<AccountInfo>>();
  let mut account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;

  if account_state
    .players
    .iter()
    .any(|player| player.gen_player_id() == new_player.gen_player_id())
  {
    return Err(AccountError::Duplicate.into());
  }

  config_state.states.shared.selected_player_id = new_player.gen_player_id();

  account_state.players.push(new_player);
  account_state.save()?;
  Ok(())
}

#[tauri::command]
pub async fn add_player_3rdparty_password(
  app: AppHandle,
  auth_server_url: String,
  username: String,
  password: String,
) -> SJMCLResult<()> {
  let new_players = password::login(app.clone(), auth_server_url, username, password).await?;

  let account_binding = app.state::<Mutex<AccountInfo>>();
  let mut account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;

  if new_players.is_empty() {
    return Err(AccountError::NotFound.into());
  }

  if new_players.len() == 1 {
    config_state.states.shared.selected_player_id = new_players[0].uuid.to_string();
  }

  let players_len_before = account_state.players.len();

  for new_player in new_players {
    if account_state
      .players
      .iter()
      .any(|player| player.gen_player_id() == new_player.gen_player_id())
    {
      // if some of the players have already been added, skip and try others
      continue;
    }

    account_state.players.push(new_player);
  }

  if players_len_before == account_state.players.len() {
    // raise duplicate error only if all players are duplicated
    return Err(AccountError::Duplicate.into());
  }

  account_state.save()?;

  Ok(())
}

#[tauri::command]
pub fn update_player_skin_offline_preset(
  app: AppHandle,
  player_id: String,
  preset_role: String,
) -> SJMCLResult<()> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  let mut account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;

  let player = account_state
    .players
    .iter_mut()
    .find(|player| player.gen_player_id() == player_id)
    .ok_or(AccountError::NotFound)?;

  if player.player_type != PlayerType::Offline {
    return Err(AccountError::Invalid.into());
  }

  if TEXTURE_ROLES.contains(&preset_role.as_str()) {
    player.textures = offline::load_preset_skin(app.clone(), preset_role)?;
  } else {
    return Err(AccountError::TextureError.into());
  }

  config_state.states.shared.selected_player_id = player_id;

  account_state.save()?;
  config_state.save()?;

  Ok(())
}

#[tauri::command]
pub fn delete_player(app: AppHandle, player_id: String) -> SJMCLResult<()> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  let mut account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;

  let initial_len = account_state.players.len();
  account_state
    .players
    .retain(|s| s.gen_player_id() != player_id);
  if account_state.players.len() == initial_len {
    return Err(AccountError::NotFound.into());
  }

  if config_state.states.shared.selected_player_id == player_id {
    config_state.states.shared.selected_player_id = account_state
      .players
      .first()
      .map_or("".to_string(), |player| player.gen_player_id());
  }

  account_state.save()?;
  config_state.save()?;
  Ok(())
}

#[tauri::command]
pub fn retrieve_auth_server_list(app: AppHandle) -> SJMCLResult<Vec<AuthServer>> {
  let binding = app.state::<Mutex<AccountInfo>>();
  let state = binding.lock()?;
  Ok(state.auth_servers.clone())
}

#[tauri::command]
pub async fn fetch_auth_server_info(app: AppHandle, url: String) -> SJMCLResult<AuthServer> {
  // check the url integrity following the standard
  // https://github.com/yushijinhun/authlib-injector/wiki/%E5%90%AF%E5%8A%A8%E5%99%A8%E6%8A%80%E6%9C%AF%E8%A7%84%E8%8C%83#%E5%9C%A8%E5%90%AF%E5%8A%A8%E5%99%A8%E4%B8%AD%E8%BE%93%E5%85%A5%E5%9C%B0%E5%9D%80
  let parsed_url = Url::parse(&url)
    .or(Url::parse(&format!("https://{}", url)))
    .map_err(|_| AccountError::Invalid)?;

  let auth_url = fetch_auth_url(parsed_url).await?;

  let binding = app.state::<Mutex<AccountInfo>>();
  {
    let state = binding.lock()?;

    if state
      .auth_servers
      .iter()
      .any(|server| server.auth_url == auth_url)
    {
      return Err(AccountError::Duplicate.into());
    }
  }

  fetch_auth_server(auth_url).await
}

#[tauri::command]
pub async fn add_auth_server(app: AppHandle, auth_url: String) -> SJMCLResult<()> {
  let binding = app.state::<Mutex<AccountInfo>>();
  {
    let state = binding.lock()?;

    if state.auth_servers.iter().any(|s| s.auth_url == auth_url) {
      // we need to strictly ensure the uniqueness of the url
      return Err(AccountError::Duplicate.into());
    }
  }

  let server = fetch_auth_server(auth_url).await?;
  let mut state = binding.lock()?;
  state.auth_servers.push(server);
  state.save()?;
  Ok(())
}

#[tauri::command]
pub fn delete_auth_server(app: AppHandle, url: String) -> SJMCLResult<()> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  let mut account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;

  let initial_len = account_state.auth_servers.len();

  // try to remove the server from the storage
  account_state
    .auth_servers
    .retain(|server| server.auth_url != url);
  if account_state.auth_servers.len() == initial_len {
    return Err(AccountError::NotFound.into());
  }

  // remove all players using this server & check if the selected player needs reset
  let mut need_reset = false;
  let selected_id = config_state.states.shared.selected_player_id.clone();

  account_state.players.retain(|player| {
    let should_remove = player.auth_server_url == url;
    if should_remove && player.gen_player_id() == selected_id {
      need_reset = true;
    }
    !should_remove
  });

  if need_reset {
    config_state.states.shared.selected_player_id = "".to_string();
  }

  account_state.save()?;
  config_state.save()?;
  Ok(())
}
