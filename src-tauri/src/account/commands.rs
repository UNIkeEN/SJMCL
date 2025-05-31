use super::{
  constants::TEXTURE_ROLES,
  helpers::{
    authlib_injector::{
      self,
      info::{fetch_auth_server_info, fetch_auth_url, get_auth_server_info_by_url},
      jar::check_authlib_jar,
    },
    microsoft, offline,
  },
  models::{
    AccountError, AccountInfo, AuthServer, OAuthCodeResponse, Player, PlayerInfo, PlayerType,
  },
};
use crate::{error::SJMCLResult, launcher_config::models::LauncherConfig, storage::Storage};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use url::Url;

#[tauri::command]
pub fn retrieve_player_list(
  account_state: State<'_, Mutex<AccountInfo>>,
) -> SJMCLResult<Vec<Player>> {
  let account = account_state.lock()?;

  let player_list: Vec<Player> = account
    .clone()
    .players
    .into_iter()
    .map(Player::from)
    .collect();
  Ok(player_list)
}

#[tauri::command]
pub async fn add_player_offline(
  app: AppHandle,
  username: String,
  uuid: String,
  account_state: State<'_, Mutex<AccountInfo>>,
  launcher_config_state: State<'_, Mutex<LauncherConfig>>,
) -> SJMCLResult<()> {
  let new_player = offline::login(&app, username, uuid).await?;

  let mut account = account_state.lock()?;
  let mut launcher_config = launcher_config_state.lock()?;

  if account
    .players
    .iter()
    .any(|player| player.id == new_player.id)
  {
    return Err(AccountError::Duplicate.into());
  }

  launcher_config.states.shared.selected_player_id = new_player.id.clone();
  launcher_config.save()?;

  account.players.push(new_player);
  account.save()?;
  Ok(())
}

#[tauri::command]
pub async fn fetch_oauth_code(
  app: AppHandle,
  server_type: PlayerType,
  auth_server_url: String,
) -> SJMCLResult<OAuthCodeResponse> {
  if server_type == PlayerType::ThirdParty {
    let auth_server = AuthServer::from(get_auth_server_info_by_url(&app, auth_server_url)?);

    authlib_injector::oauth::device_authorization(
      &app,
      auth_server.features.openid_configuration_url,
      auth_server.client_id,
    )
    .await
  } else if server_type == PlayerType::Microsoft {
    microsoft::oauth::device_authorization(&app).await
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
  account_state: State<'_, Mutex<AccountInfo>>,
  launcher_config_state: State<'_, Mutex<LauncherConfig>>,
) -> SJMCLResult<()> {
  let new_player = match server_type {
    PlayerType::ThirdParty => {
      let _ = check_authlib_jar(&app).await; // ignore the error when logging in

      let auth_server =
        AuthServer::from(get_auth_server_info_by_url(&app, auth_server_url.clone())?);

      authlib_injector::oauth::login(
        &app,
        auth_server_url,
        auth_server.features.openid_configuration_url,
        auth_server.client_id,
        auth_info,
      )
      .await?
    }

    PlayerType::Microsoft => microsoft::oauth::login(&app, auth_info).await?,

    PlayerType::Offline => {
      return Err(AccountError::Invalid.into());
    }
  };

  let mut account = account_state.lock()?;
  let mut launcher_config = launcher_config_state.lock()?;

  if account
    .players
    .iter()
    .any(|player| player.id == new_player.id)
  {
    return Err(AccountError::Duplicate.into());
  }

  launcher_config.states.shared.selected_player_id = new_player.id.clone();
  launcher_config.save()?;

  account.players.push(new_player);
  account.save()?;
  Ok(())
}

#[tauri::command]
pub async fn relogin_player_oauth(
  app: AppHandle,
  player_id: String,
  auth_info: OAuthCodeResponse,
  account_state: State<'_, Mutex<AccountInfo>>,
) -> SJMCLResult<()> {
  let cloned_account = account_state.lock()?.clone();

  let old_player = cloned_account
    .players
    .iter()
    .find(|player| player.id == player_id)
    .ok_or(AccountError::NotFound)?;

  let new_player = match old_player.player_type {
    PlayerType::ThirdParty => {
      let auth_server = AuthServer::from(get_auth_server_info_by_url(
        &app,
        old_player.auth_server_url.clone(),
      )?);

      authlib_injector::oauth::login(
        &app,
        old_player.auth_server_url.clone(),
        auth_server.features.openid_configuration_url,
        auth_server.client_id,
        auth_info,
      )
      .await?
    }

    PlayerType::Microsoft => microsoft::oauth::login(&app, auth_info).await?,

    PlayerType::Offline => {
      return Err(AccountError::Invalid.into());
    }
  };

  let mut account = account_state.lock()?;

  if let Some(player) = account
    .players
    .iter_mut()
    .find(|player| player.id == player_id)
  {
    *player = new_player;
    account.save()?;
  }

  Ok(())
}

#[tauri::command]
pub async fn add_player_3rdparty_password(
  app: AppHandle,
  auth_server_url: String,
  username: String,
  password: String,
  account_state: State<'_, Mutex<AccountInfo>>,
  launcher_config_state: State<'_, Mutex<LauncherConfig>>,
) -> SJMCLResult<Vec<Player>> {
  let _ = check_authlib_jar(&app).await;

  let mut new_players =
    authlib_injector::password::login(&app, auth_server_url, username, password).await?;

  let mut account = account_state.lock()?;
  let mut launcher_config = launcher_config_state.lock()?;

  if new_players.is_empty() {
    return Err(AccountError::NotFound.into());
  }

  new_players.retain_mut(|new_player| {
    account
      .players
      .iter()
      .all(|player| new_player.id != player.id)
  });

  if new_players.is_empty() {
    Err(AccountError::Duplicate.into())
  } else if new_players.len() == 1 {
    // if only one player will be added, save it and return **an empty vector** to inform the frontend not to trigger selector.
    launcher_config.states.shared.selected_player_id = new_players[0].id.clone();
    account.players.push(new_players[0].clone());

    account.save()?;
    launcher_config.save()?;

    Ok(vec![])
  } else {
    // if more than one player will be added, return the players to inform the frontend to trigger selector.
    let players = new_players
      .iter()
      .map(|player| Player::from(player.clone()))
      .collect::<Vec<Player>>();

    Ok(players)
  }
}

#[tauri::command]
pub async fn relogin_player_3rdparty_password(
  app: AppHandle,
  player_id: String,
  password: String,
  account_state: State<'_, Mutex<AccountInfo>>,
) -> SJMCLResult<()> {
  let cloned_account = account_state.lock()?.clone();

  let old_player = cloned_account
    .players
    .iter()
    .find(|player| player.id == player_id)
    .ok_or(AccountError::NotFound)?;

  if old_player.player_type != PlayerType::ThirdParty {
    return Err(AccountError::Invalid.into());
  }

  let player_list = authlib_injector::password::login(
    &app,
    old_player.auth_server_url.clone(),
    old_player.auth_account.clone(),
    password,
  )
  .await?;

  let new_player = player_list
    .into_iter()
    .find(|player| player.uuid == old_player.uuid)
    .ok_or(AccountError::NotFound)?;

  let refreshed_player = authlib_injector::password::refresh(&app, &new_player).await?;

  let mut account = account_state.lock()?;

  if let Some(player) = account
    .players
    .iter_mut()
    .find(|player| player.id == player_id)
  {
    *player = refreshed_player;
    account.save()?;
  }

  Ok(())
}

#[tauri::command]
pub async fn add_player_from_selection(
  app: AppHandle,
  player: Player,
  account_state: State<'_, Mutex<AccountInfo>>,
  launcher_config_state: State<'_, Mutex<LauncherConfig>>,
) -> SJMCLResult<()> {
  let player_info: PlayerInfo = player.into();
  let refreshed_player = authlib_injector::password::refresh(&app, &player_info).await?;

  let mut account = account_state.lock()?;
  let mut launcher_config = launcher_config_state.lock()?;

  if account.players.iter().any(|x| x.id == refreshed_player.id) {
    return Err(AccountError::Duplicate.into());
  }

  launcher_config.states.shared.selected_player_id = refreshed_player.id.clone();
  account.players.push(refreshed_player);

  account.save()?;
  launcher_config.save()?;
  Ok(())
}

#[tauri::command]
pub fn update_player_skin_offline_preset(
  app: AppHandle,
  player_id: String,
  preset_role: String,
  account_state: State<'_, Mutex<AccountInfo>>,
) -> SJMCLResult<()> {
  let mut account = account_state.lock()?;

  let player = account
    .get_player_by_id_mut(player_id.clone())
    .ok_or(AccountError::NotFound)?;

  if player.player_type != PlayerType::Offline {
    return Err(AccountError::Invalid.into());
  }

  if TEXTURE_ROLES.contains(&preset_role.as_str()) {
    player.textures = offline::load_preset_skin(&app, preset_role)?;
  } else {
    return Err(AccountError::TextureError.into());
  }

  account.save()?;
  Ok(())
}

#[tauri::command]
pub fn delete_player(
  player_id: String,
  account_state: State<'_, Mutex<AccountInfo>>,
  launcher_config_state: State<'_, Mutex<LauncherConfig>>,
) -> SJMCLResult<()> {
  let mut account = account_state.lock()?;
  let mut launcher_config = launcher_config_state.lock()?;

  let initial_len = account.players.len();
  account.players.retain(|s| s.id != player_id);
  if account.players.len() == initial_len {
    return Err(AccountError::NotFound.into());
  }

  if launcher_config.states.shared.selected_player_id == player_id {
    launcher_config.states.shared.selected_player_id = account
      .players
      .first()
      .map_or("".to_string(), |player| player.id.clone());
    launcher_config.save()?;
  }

  account.save()?;
  Ok(())
}

#[tauri::command]
pub async fn refresh_player(
  app: AppHandle,
  player_id: String,
  account_state: State<'_, Mutex<AccountInfo>>,
) -> SJMCLResult<()> {
  let cloned_account = account_state.lock()?.clone();

  let player = cloned_account
    .players
    .iter()
    .find(|player| player.id == player_id)
    .ok_or(AccountError::NotFound)?;

  let refreshed_player = match player.player_type {
    PlayerType::ThirdParty => {
      let auth_server = AuthServer::from(get_auth_server_info_by_url(
        &app,
        player.auth_server_url.clone(),
      )?);

      authlib_injector::common::refresh(&app, player, &auth_server).await?
    }

    PlayerType::Microsoft => microsoft::oauth::refresh(&app, player).await?,

    PlayerType::Offline => {
      return Err(AccountError::Invalid.into());
    }
  };

  let mut account = account_state.lock()?;

  if let Some(player) = account
    .players
    .iter_mut()
    .find(|player| player.id == player_id)
  {
    *player = refreshed_player;
    account.save()?;
  }

  Ok(())
}

#[tauri::command]
pub fn retrieve_auth_server_list(
  account_state: State<'_, Mutex<AccountInfo>>,
) -> SJMCLResult<Vec<AuthServer>> {
  let account = account_state.lock()?;
  let auth_servers = account
    .auth_servers
    .iter()
    .map(|server| AuthServer::from(server.clone()))
    .collect();
  Ok(auth_servers)
}

#[tauri::command]
pub async fn fetch_auth_server(app: AppHandle, url: String) -> SJMCLResult<AuthServer> {
  // check the url integrity following the standard
  // https://github.com/yushijinhun/authlib-injector/wiki/%E5%90%AF%E5%8A%A8%E5%99%A8%E6%8A%80%E6%9C%AF%E8%A7%84%E8%8C%83#%E5%9C%A8%E5%90%AF%E5%8A%A8%E5%99%A8%E4%B8%AD%E8%BE%93%E5%85%A5%E5%9C%B0%E5%9D%80
  let parsed_url = Url::parse(&url)
    .or(Url::parse(&format!("https://{}", url)))
    .map_err(|_| AccountError::Invalid)?;

  let auth_url = fetch_auth_url(&app, parsed_url).await?;

  if get_auth_server_info_by_url(&app, auth_url.clone()).is_ok() {
    return Err(AccountError::Duplicate.into());
  }

  Ok(AuthServer::from(
    fetch_auth_server_info(&app, auth_url).await?,
  ))
}

#[tauri::command]
pub async fn add_auth_server(
  app: AppHandle,
  auth_url: String,
  account_state: State<'_, Mutex<AccountInfo>>,
) -> SJMCLResult<()> {
  if get_auth_server_info_by_url(&app, auth_url.clone()).is_ok() {
    return Err(AccountError::Duplicate.into());
  }

  let server = fetch_auth_server_info(&app, auth_url).await?;

  let mut account = account_state.lock()?;
  account.auth_servers.push(server);
  account.save()?;
  Ok(())
}

#[tauri::command]
pub fn delete_auth_server(
  url: String,
  account_state: State<'_, Mutex<AccountInfo>>,
  launcher_config_state: State<'_, Mutex<LauncherConfig>>,
) -> SJMCLResult<()> {
  let mut account = account_state.lock()?;
  let mut launcher_config = launcher_config_state.lock()?;
  let initial_len = account.auth_servers.len();

  // try to remove the server from the storage
  account.auth_servers.retain(|server| server.auth_url != url);
  if account.auth_servers.len() == initial_len {
    return Err(AccountError::NotFound.into());
  }

  // remove all players using this server & check if the selected player needs reset
  let mut need_reset = false;
  let selected_id = launcher_config.states.shared.selected_player_id.clone();

  account.players.retain(|player| {
    let should_remove = player.auth_server_url == url;
    if should_remove && player.id == selected_id {
      need_reset = true;
    }
    !should_remove
  });

  if need_reset {
    if let Some(first_player) = account.players.first() {
      launcher_config.states.shared.selected_player_id = first_player.id.clone();
    } else {
      launcher_config.states.shared.selected_player_id = "".to_string();
    }
  }

  account.save()?;
  launcher_config.save()?;
  Ok(())
}
