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
use crate::{
  account::helpers::misc, error::SJMCLResult, launcher_config::models::LauncherConfig,
  storage::Storage,
};
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
pub async fn add_player_offline(app: AppHandle, username: String, uuid: String) -> SJMCLResult<()> {
  let new_player = offline::login(&app, username, uuid).await?;

  let account_binding = app.state::<Mutex<AccountInfo>>();
  let mut account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;

  if account_state
    .players
    .iter()
    .any(|player| player.id == new_player.id)
  {
    return Err(AccountError::Duplicate.into());
  }

  config_state.partial_update(
    &app,
    "states.shared.selected_player_id",
    &serde_json::to_string(&new_player.id).unwrap_or_default(),
  )?;
  config_state.save()?;

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

  {
    let account_binding = app.state::<Mutex<AccountInfo>>();
    let mut account_state = account_binding.lock()?;

    let config_binding = app.state::<Mutex<LauncherConfig>>();
    let mut config_state = config_binding.lock()?;

    if account_state
      .players
      .iter()
      .any(|player| player.id == new_player.id)
    {
      return Err(AccountError::Duplicate.into());
    }

    config_state.partial_update(
      &app,
      "states.shared.selected_player_id",
      &serde_json::to_string(&new_player.id).unwrap_or_default(),
    )?;
    config_state.save()?;

    account_state.players.push(new_player);
    account_state.save()?;
  }

  misc::check_full_login_availability(&app).await
}

#[tauri::command]
pub async fn relogin_player_oauth(
  app: AppHandle,
  player_id: String,
  auth_info: OAuthCodeResponse,
) -> SJMCLResult<()> {
  let account_binding = app.state::<Mutex<AccountInfo>>();

  let cloned_account_state = account_binding.lock()?.clone();

  let old_player = cloned_account_state
    .players
    .iter()
    .find(|player| player.id == player_id)
    .ok_or(AccountError::NotFound)?;

  let new_player = match old_player.player_type {
    PlayerType::ThirdParty => {
      let auth_server = AuthServer::from(get_auth_server_info_by_url(
        &app,
        old_player.auth_server_url.clone().unwrap_or_default(),
      )?);

      authlib_injector::oauth::login(
        &app,
        old_player.auth_server_url.clone().unwrap_or_default(),
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

  {
    let mut account_state = account_binding.lock()?;

    if let Some(player) = account_state
      .players
      .iter_mut()
      .find(|player| player.id == player_id)
    {
      *player = new_player;
      account_state.save()?;
    }
  }

  misc::check_full_login_availability(&app).await
}

#[tauri::command]
pub fn cancel_oauth(app: AppHandle) -> SJMCLResult<()> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  let mut account_state = account_binding.lock()?;
  account_state.is_oauth_processing = false;

  Ok(())
}

#[tauri::command]
pub async fn add_player_3rdparty_password(
  app: AppHandle,
  auth_server_url: String,
  username: String,
  password: String,
) -> SJMCLResult<Vec<Player>> {
  let _ = check_authlib_jar(&app).await; // ignore the error when logging in

  let mut new_players =
    authlib_injector::password::login(&app, auth_server_url, username, password).await?;

  let account_binding = app.state::<Mutex<AccountInfo>>();
  let mut account_state = account_binding.lock()?;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;

  if new_players.is_empty() {
    return Err(AccountError::NotFound.into());
  }

  new_players.retain_mut(|new_player| {
    account_state
      .players
      .iter()
      .all(|player| new_player.id != player.id)
  });

  if new_players.is_empty() {
    Err(AccountError::Duplicate.into())
  } else if new_players.len() == 1 {
    // if only one player will be added, save it and return **an empty vector** to inform the frontend not to trigger selector.
    config_state.partial_update(
      &app,
      "states.shared.selected_player_id",
      &serde_json::to_string(&new_players[0].id).unwrap_or_default(),
    )?;
    account_state.players.push(new_players[0].clone());

    account_state.save()?;
    config_state.save()?;

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
) -> SJMCLResult<()> {
  let account_binding = app.state::<Mutex<AccountInfo>>();

  let cloned_account_state = account_binding.lock()?.clone();

  let old_player = cloned_account_state
    .players
    .iter()
    .find(|player| player.id == player_id)
    .ok_or(AccountError::NotFound)?;

  if old_player.player_type != PlayerType::ThirdParty {
    return Err(AccountError::Invalid.into());
  }

  let player_list = authlib_injector::password::login(
    &app,
    old_player.auth_server_url.clone().unwrap_or_default(),
    old_player.auth_account.clone().unwrap_or_default(),
    password,
  )
  .await?;

  let new_player = player_list
    .into_iter()
    .find(|player| player.uuid == old_player.uuid)
    .ok_or(AccountError::NotFound)?;

  let refreshed_player = authlib_injector::password::refresh(&app, &new_player).await?;

  {
    let mut account_state = account_binding.lock()?;

    if let Some(player) = account_state
      .players
      .iter_mut()
      .find(|player| player.id == player_id)
    {
      *player = refreshed_player;
      account_state.save()?;
    }
  }

  misc::check_full_login_availability(&app).await
}

#[tauri::command]
pub async fn add_player_from_selection(app: AppHandle, player: Player) -> SJMCLResult<()> {
  let player_info: PlayerInfo = player.into();
  let refreshed_player = authlib_injector::password::refresh(&app, &player_info).await?;

  {
    let account_binding = app.state::<Mutex<AccountInfo>>();
    let mut account_state = account_binding.lock()?;

    let config_binding = app.state::<Mutex<LauncherConfig>>();
    let mut config_state = config_binding.lock()?;

    if account_state
      .players
      .iter()
      .any(|x| x.id == refreshed_player.id)
    {
      return Err(AccountError::Duplicate.into());
    }

    config_state.partial_update(
      &app,
      "states.shared.selected_player_id",
      &serde_json::to_string(&refreshed_player.id).unwrap_or_default(),
    )?;
    account_state.players.push(refreshed_player);

    account_state.save()?;
    config_state.save()?;
  }

  misc::check_full_login_availability(&app).await
}

#[tauri::command]
pub fn update_player_skin_offline_preset(
  app: AppHandle,
  player_id: String,
  preset_role: String,
) -> SJMCLResult<()> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  let mut account_state = account_binding.lock()?;

  let player = account_state
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

  account_state.save()?;
  Ok(())
}

#[tauri::command]
pub async fn delete_player(app: AppHandle, player_id: String) -> SJMCLResult<()> {
  {
    let account_binding = app.state::<Mutex<AccountInfo>>();
    let mut account_state = account_binding.lock()?;

    let config_binding = app.state::<Mutex<LauncherConfig>>();
    let mut config_state = config_binding.lock()?;

    let initial_len = account_state.players.len();
    account_state.players.retain(|s| s.id != player_id);
    if account_state.players.len() == initial_len {
      return Err(AccountError::NotFound.into());
    }

    if config_state.states.shared.selected_player_id == player_id {
      config_state.partial_update(
        &app,
        "states.shared.selected_player_id",
        &serde_json::to_string(
          &account_state
            .players
            .first()
            .map_or("".to_string(), |player| player.id.clone()),
        )
        .unwrap_or_default(),
      )?;
      config_state.save()?;
    }

    account_state.save()?;
  }

  misc::check_full_login_availability(&app).await
}

#[tauri::command]
pub async fn refresh_player(app: AppHandle, player_id: String) -> SJMCLResult<()> {
  let account_binding = app.state::<Mutex<AccountInfo>>();

  let cloned_account_state = account_binding.lock()?.clone();

  let player = cloned_account_state
    .players
    .iter()
    .find(|player| player.id == player_id)
    .ok_or(AccountError::NotFound)?;

  let refreshed_player = match player.player_type {
    PlayerType::ThirdParty => {
      let auth_server = AuthServer::from(get_auth_server_info_by_url(
        &app,
        player.auth_server_url.clone().unwrap_or_default(),
      )?);

      authlib_injector::common::refresh(&app, player, &auth_server).await?
    }

    PlayerType::Microsoft => microsoft::oauth::refresh(&app, player).await?,

    PlayerType::Offline => {
      return Err(AccountError::Invalid.into());
    }
  };

  let mut account_state = account_binding.lock()?;

  if let Some(player) = account_state
    .players
    .iter_mut()
    .find(|player| player.id == player_id)
  {
    *player = refreshed_player;
    account_state.save()?;
  }

  Ok(())
}

#[tauri::command]
pub fn retrieve_auth_server_list(app: AppHandle) -> SJMCLResult<Vec<AuthServer>> {
  let binding = app.state::<Mutex<AccountInfo>>();
  let state = binding.lock()?;
  let auth_servers = state
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
pub async fn add_auth_server(app: AppHandle, auth_url: String) -> SJMCLResult<()> {
  if get_auth_server_info_by_url(&app, auth_url.clone()).is_ok() {
    return Err(AccountError::Duplicate.into());
  }

  let server = fetch_auth_server_info(&app, auth_url).await?;

  let binding = app.state::<Mutex<AccountInfo>>();
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
    let should_remove = player.auth_server_url == Some(url.clone());
    if should_remove && player.id == selected_id {
      need_reset = true;
    }
    !should_remove
  });

  if need_reset {
    config_state.partial_update(
      &app,
      "states.shared.selected_player_id",
      &serde_json::to_string(
        &(if let Some(first_player) = account_state.players.first() {
          first_player.id.clone()
        } else {
          "".to_string()
        }),
      )
      .unwrap_or_default(),
    )?;
  }

  account_state.save()?;
  config_state.save()?;
  Ok(())
}
