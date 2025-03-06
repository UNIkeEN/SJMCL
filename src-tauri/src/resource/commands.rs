use super::{
  helpers::{
    fabric_meta::get_fabric_meta_by_game_version, forge_meta::get_forge_meta_by_game_version,
    misc::get_source_priority_list, neoforge_meta::get_neoforge_meta_by_game_version,
    version_manifest::get_game_version_list,
  },
  models::{GameResourceInfo, ModLoaderResourceInfo, ResourceError},
};
use crate::{
  error::SJMCLResult, instance::models::misc::ModLoaderType,
  launcher_config::models::LauncherConfig,
};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub async fn fetch_game_version_list(
  state: State<'_, Mutex<LauncherConfig>>,
) -> SJMCLResult<Vec<GameResourceInfo>> {
  let priority_list = {
    let state = state.lock()?;
    get_source_priority_list(&state)
  };
  get_game_version_list(&priority_list).await
}

#[tauri::command]
pub async fn fetch_mod_loader_version_list(
  game_version: String,
  mod_loader_type: ModLoaderType,
  state: State<'_, Mutex<LauncherConfig>>,
) -> SJMCLResult<Vec<ModLoaderResourceInfo>> {
  let priority_list = {
    let state = state.lock()?;
    get_source_priority_list(&state)
  };
  match mod_loader_type {
    ModLoaderType::Forge | ModLoaderType::ForgeOld => {
      return get_forge_meta_by_game_version(&priority_list, &game_version).await;
    }
    ModLoaderType::Fabric => {
      return get_fabric_meta_by_game_version(&priority_list, &game_version).await;
    }
    ModLoaderType::NeoForge => {
      return get_neoforge_meta_by_game_version(&priority_list, &game_version).await;
    }
    // TODO here
    _ => Err(ResourceError::NoDownloadApi.into()),
  }
}
