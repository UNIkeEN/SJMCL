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
  error::SJMCLResult, instance::models::misc::ModLoaderType,
  launcher_config::models::LauncherConfig,
};
use std::sync::Mutex;
use tauri::{AppHandle, State};

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
