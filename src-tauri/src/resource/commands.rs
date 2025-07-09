use super::{
  helpers::{
    curseforge::{fetch_resource_list_by_name_curseforge, fetch_resource_version_packs_curseforge},
    fabric_meta::get_fabric_meta_by_game_version,
    forge_meta::get_forge_meta_by_game_version,
    misc::get_source_priority_list,
    modrinth::{fetch_resource_list_by_name_modrinth, fetch_resource_version_packs_modrinth},
    neoforge_meta::get_neoforge_meta_by_game_version,
    version_manifest::get_game_version_manifest,
  },
  models::{
    ExtraResourceSearchQuery, ExtraResourceSearchRes, GameClientResourceInfo,
    ModLoaderResourceInfo, ResourceError, ResourceVersionPack, ResourceVersionPackQuery,
  },
};
use crate::{
  error::SJMCLResult,
  instance::{helpers::client_json::McClientInfo, models::misc::ModLoaderType},
  launcher_config::models::LauncherConfig,
  tasks::{commands::schedule_progressive_task_group, download::DownloadParam, PTaskParam},
};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_http::reqwest;

#[tauri::command]
pub async fn fetch_game_version_list(
  app: AppHandle,
  state: State<'_, Mutex<LauncherConfig>>,
) -> SJMCLResult<Vec<GameClientResourceInfo>> {
  let priority_list = {
    let state = state.lock()?;
    get_source_priority_list(&state)
  };
  get_game_version_manifest(&app, &priority_list).await
}

#[tauri::command]
pub async fn fetch_mod_loader_version_list(
  app: AppHandle,
  game_version: String,
  mod_loader_type: ModLoaderType,
  state: State<'_, Mutex<LauncherConfig>>,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let priority_list = {
    let state = state.lock()?;
    get_source_priority_list(&state)
  };
  match mod_loader_type {
    ModLoaderType::Forge | ModLoaderType::LegacyForge => {
      Ok(get_forge_meta_by_game_version(&app, &priority_list, &game_version).await?)
    }
    ModLoaderType::Fabric => {
      Ok(get_fabric_meta_by_game_version(&app, &priority_list, &game_version).await?)
    }
    ModLoaderType::NeoForge => {
      Ok(get_neoforge_meta_by_game_version(&app, &priority_list, &game_version).await?)
    }
    // TODO here
    _ => Err(ResourceError::NoDownloadApi.into()),
  }
}

#[tauri::command]
pub async fn fetch_resource_list_by_name(
  app: AppHandle,
  download_source: String,
  query: ExtraResourceSearchQuery,
) -> SJMCLResult<ExtraResourceSearchRes> {
  match download_source.as_str() {
    "CurseForge" => Ok(fetch_resource_list_by_name_curseforge(&app, &query).await?),
    "Modrinth" => Ok(fetch_resource_list_by_name_modrinth(&app, &query).await?),
    _ => Err(ResourceError::NoDownloadApi.into()),
  }
}

#[tauri::command]
pub async fn fetch_resource_version_packs(
  app: AppHandle,
  download_source: String,
  query: ResourceVersionPackQuery,
) -> SJMCLResult<Vec<ResourceVersionPack>> {
  match download_source.as_str() {
    "CurseForge" => Ok(fetch_resource_version_packs_curseforge(&app, &query).await?),
    "Modrinth" => Ok(fetch_resource_version_packs_modrinth(&app, &query).await?),
    _ => Err(ResourceError::NoDownloadApi.into()),
  }
}

#[tauri::command]
pub async fn download_game_server(
  app: AppHandle,
  client: State<'_, reqwest::Client>,
  resource_info: GameClientResourceInfo,
  dest: String,
) -> SJMCLResult<()> {
  let version_details = client
    .get(&resource_info.url)
    .send()
    .await
    .map_err(|_| ResourceError::NetworkError)?
    .json::<McClientInfo>()
    .await
    .map_err(|_| ResourceError::ParseError)?;

  let download_info = version_details
    .downloads
    .get("server")
    .ok_or(ResourceError::ParseError)?;

  schedule_progressive_task_group(
    app,
    format!("game-server-download:{}", resource_info.id),
    vec![PTaskParam::Download(DownloadParam {
      src: url::Url::parse(&download_info.url.clone()).map_err(|_| ResourceError::ParseError)?,
      dest: dest.clone().into(),
      filename: None,
      sha1: Some(download_info.sha1.clone()),
    })],
    true,
  )
  .await?;

  Ok(())
}
