use crate::account::helpers::authlib_injector::info::{
  fetch_auth_server_info, fetch_auth_url, get_auth_server_info_by_url,
};
use crate::account::helpers::authlib_injector::jar::check_authlib_jar;
use crate::account::helpers::authlib_injector::{self};
use crate::account::helpers::import::ImportLauncherType;
use crate::account::helpers::import::hmcl::retrieve_hmcl_account_info;
use crate::account::helpers::import::multimc::retrieve_multimc_account_info;
use crate::account::helpers::microsoft::models::{MicrosoftFriendAction, MicrosoftFriendList};
use crate::account::helpers::{microsoft, misc, offline};
use crate::account::models::{
  AccountError, AccountInfo, AuthServer, DeviceAuthResponseInfo, Player, PlayerInfo, PlayerType,
  PresetRole, SkinModel, TextureType,
};
use crate::error::SJMCLResult;
use crate::storage::Storage;
use crate::utils::fs::get_app_resource_filepath;
use crate::utils::state_extractor;
use crate::utils::web::normalize_url;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use url::Url;

#[tauri::command]
pub fn retrieve_player_list(app: AppHandle) -> SJMCLResult<Vec<Player>> {
  let player_list: Vec<Player> = state_extractor::with_account_info(&app, |accounts| {
    Ok(
      accounts
        .players
        .clone()
        .into_iter()
        .map(Player::from)
        .collect(),
    )
  })?;

  // ensure a player is selected when player_list is not empty
  if !player_list.is_empty() {
    state_extractor::with_launcher_config(&app, |config| {
      if !player_list
        .iter()
        .any(|player| player.id == config.states.shared.selected_player_id)
      {
        config.partial_update(
          &app,
          "states.shared.selected_player_id",
          &serde_json::to_string(&player_list[0].id).unwrap_or_default(),
        )?;
        config.save()?;
      }
      Ok(())
    })?;
  }

  Ok(player_list)
}

#[tauri::command]
pub async fn add_player_offline(app: AppHandle, username: String, uuid: String) -> SJMCLResult<()> {
  let new_player = offline::login(&app, username, uuid).await?;

  misc::add_player(&app, new_player)
}

#[tauri::command]
pub async fn fetch_oauth_code(
  app: AppHandle,
  server_type: PlayerType,
  auth_server_url: String,
) -> SJMCLResult<DeviceAuthResponseInfo> {
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
  auth_info: DeviceAuthResponseInfo,
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

  misc::add_player(&app, new_player)?;

  if server_type == PlayerType::Microsoft {
    misc::check_full_login_availability(&app).await?;
  }

  Ok(())
}

#[tauri::command]
pub async fn relogin_player_oauth(
  app: AppHandle,
  player_id: String,
  auth_info: DeviceAuthResponseInfo,
) -> SJMCLResult<()> {
  let old_player = state_extractor::with_account_info(&app, |accounts| {
    Ok(accounts.get_player_by_id(&player_id)?.clone())
  })?;

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

  state_extractor::with_account_info(&app, |accounts| {
    let player = accounts.get_player_by_id_mut(&player_id)?;
    *player = new_player;
    accounts.save()?;
    Ok(())
  })?;

  misc::check_full_login_availability(&app).await
}

#[tauri::command]
pub fn cancel_oauth(app: AppHandle) -> SJMCLResult<()> {
  state_extractor::with_account_info(&app, |accounts| {
    accounts.is_oauth_processing = false;
    Ok(())
  })?;

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

  let (mut new_players, is_token_binded) =
    authlib_injector::password::login(&app, auth_server_url, username, password).await?;

  if new_players.is_empty() {
    return Err(AccountError::NotFound.into());
  }

  state_extractor::with_account_info(&app, |info| {
    new_players
      .retain_mut(|new_player| info.players.iter().all(|player| new_player.id != player.id));
    Ok(())
  })?;

  if new_players.is_empty() {
    Err(AccountError::Duplicate.into())
  } else if new_players.len() == 1 {
    // if only one player will be added, save it and return **an empty vector** to inform the frontend not to trigger selector.
    if !is_token_binded {
      // if the token is not binded, refresh it to bind the token.
      new_players[0] = authlib_injector::password::refresh(&app, &new_players[0], true).await?;
    }

    misc::add_player(&app, new_players.remove(0))?;
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
  let old_player = state_extractor::with_account_info(&app, |accounts| {
    Ok(accounts.get_player_by_id(&player_id)?.clone())
  })?;

  if old_player.player_type != PlayerType::ThirdParty {
    return Err(AccountError::Invalid.into());
  }

  let (player_list, is_token_binded) = authlib_injector::password::login(
    &app,
    old_player.auth_server_url.clone().unwrap_or_default(),
    old_player.auth_account.clone().unwrap_or_default(),
    password,
  )
  .await?;

  let mut new_player = player_list
    .into_iter()
    .find(|player| player.uuid == old_player.uuid)
    .ok_or(AccountError::NotFound)?;

  if !is_token_binded {
    new_player = authlib_injector::password::refresh(&app, &new_player, true).await?;
  }

  state_extractor::with_account_info(&app, |accounts| {
    let player = accounts.get_player_by_id_mut(&player_id)?;
    *player = new_player;
    accounts.save()?;
    Ok(())
  })?;

  misc::check_full_login_availability(&app).await
}

#[tauri::command]
pub async fn add_player_from_selection(app: AppHandle, player: Player) -> SJMCLResult<()> {
  let player_info: PlayerInfo = player.into();
  let refreshed_player = authlib_injector::password::refresh(&app, &player_info, true).await?;

  misc::add_player(&app, refreshed_player)
}

#[tauri::command]
pub fn update_player_skin_offline_preset(
  app: AppHandle,
  player_id: String,
  preset_role: PresetRole,
) -> SJMCLResult<()> {
  state_extractor::with_account_info(&app, |accounts| {
    let player = accounts.get_player_by_id_mut(&player_id)?;

    if player.player_type != PlayerType::Offline {
      return Err(AccountError::Invalid.into());
    }

    player.textures = offline::load_preset_skin(&app, preset_role)?;
    accounts.save()?;
    Ok(())
  })
}

#[tauri::command]
pub fn update_player_skin_offline_local(
  app: AppHandle,
  player_id: String,
  image_path: String,
  texture_type: TextureType,
  skin_model: SkinModel,
) -> SJMCLResult<()> {
  let image_path = if image_path == "dummy" {
    // this is an Easter Egg :)
    get_app_resource_filepath(&app, "assets/skins/dummy.png")
      .map_err(|_| AccountError::TextureError)?
  } else {
    Path::new(&image_path).to_path_buf()
  };
  let texture_img =
    crate::utils::image::load_image_from_dir(&image_path).ok_or(AccountError::TextureError)?;

  state_extractor::with_account_info(&app, |accounts| {
    let player = accounts.get_player_by_id_mut(&player_id)?;

    if player.player_type != PlayerType::Offline {
      return Err(AccountError::Invalid.into());
    }

    // remove existing texture of the same type
    player
      .textures
      .retain(|texture| texture.texture_type != texture_type);

    // add the new texture
    player.textures.push(crate::account::models::Texture {
      texture_type: texture_type.clone(),
      image: texture_img.into(),
      model: skin_model.clone(),
      preset: None,
    });

    accounts.save()?;
    Ok(())
  })
}

#[tauri::command]
pub async fn delete_player(app: AppHandle, player_id: String) -> SJMCLResult<()> {
  let selected_player_id = state_extractor::with_account_info(&app, |accounts| {
    let initial_len = accounts.players.len();
    accounts.players.retain(|s| s.id != player_id);
    if accounts.players.len() == initial_len {
      return Err(AccountError::NotFound.into());
    }

    accounts.save()?;
    Ok(
      accounts
        .players
        .first()
        .map_or("".to_string(), |player| player.id.clone()),
    )
  })?;

  state_extractor::with_launcher_config(&app, |config| {
    if config.states.shared.selected_player_id == player_id {
      config.partial_update(
        &app,
        "states.shared.selected_player_id",
        &serde_json::to_string(&selected_player_id).unwrap_or_default(),
      )?;
      config.save()?;
    }
    Ok(())
  })?;

  misc::check_full_login_availability(&app).await
}

#[tauri::command]
pub async fn refresh_player(app: AppHandle, player_id: String) -> SJMCLResult<()> {
  let player = state_extractor::with_account_info(&app, |accounts| {
    Ok(accounts.get_player_by_id(&player_id)?.clone())
  })?;
  let refreshed_player = match player.player_type {
    PlayerType::ThirdParty => {
      let auth_server = AuthServer::from(get_auth_server_info_by_url(
        &app,
        player.auth_server_url.clone().unwrap_or_default(),
      )?);

      authlib_injector::common::refresh(&app, &player, &auth_server).await?
    }

    PlayerType::Microsoft => microsoft::oauth::refresh(&app, &player).await?,

    PlayerType::Offline => {
      return Err(AccountError::Invalid.into());
    }
  };

  state_extractor::with_account_info(&app, |accounts| {
    accounts.update_player(&player_id, refreshed_player)
  })?;

  Ok(())
}

#[tauri::command]
pub async fn retrieve_microsoft_friend_list(
  app: AppHandle,
  cur_player_id: String,
) -> SJMCLResult<MicrosoftFriendList> {
  let player = state_extractor::with_account_info(&app, |accounts| {
    Ok(accounts.get_player_by_id(&cur_player_id)?.clone())
  })?;

  if player.player_type != PlayerType::Microsoft {
    return Err(AccountError::Invalid.into());
  }

  microsoft::friends::retrieve_friend_list(&app, &player).await
}

#[tauri::command]
pub async fn update_microsoft_friend(
  app: AppHandle,
  cur_player_id: String,
  tgt_player_name: Option<String>,
  tgt_player_uuid: Option<String>,
  action: MicrosoftFriendAction,
) -> SJMCLResult<MicrosoftFriendList> {
  let player = state_extractor::with_account_info(&app, |accounts| {
    Ok(accounts.get_player_by_id(&cur_player_id)?.clone())
  })?;

  if player.player_type != PlayerType::Microsoft {
    return Err(AccountError::Invalid.into());
  }

  let tgt_player_name = tgt_player_name
    .map(|name| name.trim().to_string())
    .filter(|name| !name.is_empty());
  let tgt_player_uuid = match tgt_player_uuid {
    Some(uuid) if !uuid.is_empty() => {
      Some(uuid::Uuid::parse_str(&uuid).map_err(|_| AccountError::Invalid)?)
    }
    _ => None,
  };

  microsoft::friends::update_friend(&app, &player, tgt_player_name, tgt_player_uuid, action).await
}

#[tauri::command]
pub fn retrieve_auth_server_list(app: AppHandle) -> SJMCLResult<Vec<AuthServer>> {
  state_extractor::with_account_info(&app, |accounts| {
    Ok(
      accounts
        .auth_servers
        .iter()
        .map(|server| AuthServer::from(server.clone()))
        .collect(),
    )
  })
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

  state_extractor::with_account_info(&app, |accounts| {
    accounts.auth_servers.push(server.clone());
    accounts.save()?;
    Ok(())
  })?;
  Ok(())
}

#[tauri::command]
pub fn delete_auth_server(app: AppHandle, url: String) -> SJMCLResult<()> {
  state_extractor::with_account_info(&app, |accounts| {
    let initial_len = accounts.auth_servers.len();

    // try to remove the server from the storage
    accounts
      .auth_servers
      .retain(|server| server.auth_url != url);
    if accounts.auth_servers.len() == initial_len {
      return Err(AccountError::NotFound.into());
    }
    Ok(())
  })?;

  // remove all players using this server & check if the selected player needs reset
  let mut need_reset = false;
  let selected_id = state_extractor::with_launcher_config(&app, |config| {
    Ok(config.states.shared.selected_player_id.clone())
  })?;

  let first_player_id = state_extractor::with_account_info(&app, |accounts| {
    accounts.players.retain(|player| {
      let should_remove = player.auth_server_url == Some(url.clone());
      if should_remove && player.id == selected_id {
        need_reset = true;
      }
      !should_remove
    });
    accounts.save()?;

    Ok(accounts.players.first().map(|x| x.id.clone()))
  })?;

  state_extractor::with_launcher_config(&app, |config| {
    if need_reset {
      config.partial_update(
        &app,
        "states.shared.selected_player_id",
        &serde_json::to_string(
          &(if let Some(first_player) = first_player_id {
            first_player
          } else {
            "".to_string()
          }),
        )
        .unwrap_or_default(),
      )?;
    }

    config.save()?;
    Ok(())
  })?;

  Ok(())
}

// Stage 1 of importing accounts (players and auth servers) from other launchers
#[tauri::command]
pub async fn retrieve_other_launcher_account_info(
  app: AppHandle,
  launcher_type: ImportLauncherType,
) -> SJMCLResult<(Vec<Player>, Vec<AuthServer>)> {
  let (mut player_infos, urls) = match launcher_type {
    ImportLauncherType::HMCL => retrieve_hmcl_account_info(&app).await?,
    ImportLauncherType::MultiMC => retrieve_multimc_account_info(&app).await?,
    _ => return Ok((vec![], vec![])),
  };

  // remove trailing slashes for deduplication
  let mut url_set = std::collections::HashSet::<String>::new();
  for u in urls {
    url_set.insert(normalize_url(u.as_str()));
  }
  for p in &mut player_infos {
    if let Some(url) = p.auth_server_url.as_mut() {
      *url = normalize_url(url);
    }
  }

  // fetch auth servers
  let mut auth_server_infos = Vec::new();
  for url in url_set {
    auth_server_infos.push(fetch_auth_server_info(&app, url).await?);
  }

  Ok((
    player_infos
      .into_iter()
      .map(|p| Player::from_player_info(p, Some(&auth_server_infos)))
      .collect(),
    auth_server_infos
      .into_iter()
      .map(AuthServer::from)
      .collect(),
  ))
}

// Stage 2 of importing accounts from other launchers
#[tauri::command]
pub async fn import_external_account_info(
  app: AppHandle,
  players: Vec<Player>,
  auth_servers: Vec<AuthServer>,
) -> SJMCLResult<()> {
  // fetch auth servers
  let fetch_tasks = auth_servers.into_iter().map(|server| {
    let app = app.clone();
    async move { fetch_auth_server_info(&app, server.auth_url).await }
  });

  let fetched = futures::future::join_all(fetch_tasks).await;
  let mut fetched_infos = Vec::with_capacity(fetched.len());
  for r in fetched {
    fetched_infos.push(r?);
  }

  let account_binding = app.state::<Mutex<AccountInfo>>();
  let mut account_state = account_binding.lock()?;

  // servers: same url overwritten
  for server_info in fetched_infos {
    if let Some(existing) = account_state
      .auth_servers
      .iter_mut()
      .find(|s| s.auth_url == server_info.auth_url)
    {
      *existing = server_info;
    } else {
      account_state.auth_servers.push(server_info);
    }
  }

  // players: same id overwritten
  for player in players {
    let player_info: PlayerInfo = player.into();
    if let Some(existing) = account_state
      .players
      .iter_mut()
      .find(|p| p.id == player_info.id)
    {
      *existing = player_info;
    } else {
      account_state.players.push(player_info);
    }
  }

  account_state.save()?;
  Ok(())
}
