use super::{
  helpers::{
    curseforge::{fetch_resource_list_by_name_curseforge, fetch_resource_version_packs_curseforge},
    loader_meta::{
      fabric::get_fabric_meta_by_game_version, forge::get_forge_meta_by_game_version,
      neoforge::get_neoforge_meta_by_game_version,
    },
    misc::get_source_priority_list,
    modrinth::{fetch_resource_list_by_name_modrinth, fetch_resource_version_packs_modrinth},
    version_manifest::get_game_version_manifest,
  },
  models::{
    GameClientResourceInfo, ModLoaderResourceInfo, OtherResourceSearchQuery,
    OtherResourceSearchRes, OtherResourceVersionPack, OtherResourceVersionPackQuery, ResourceError,
  },
};
use crate::{
  error::SJMCLResult,
  instance::{
    helpers::{client_json::McClientInfo, misc::get_instance_subdir_path_by_id},
    models::misc::{InstanceSubdirType, ModLoaderType},
  },
  launcher_config::models::LauncherConfig,
  resource::{
    helpers::{
      curseforge::{
        fetch_remote_resource_by_id_curseforge, fetch_remote_resource_by_local_curseforge,
      },
      modrinth::{fetch_remote_resource_by_id_modrinth, fetch_remote_resource_by_local_modrinth},
    },
    models::{ModUpdateQuery, OtherResourceFileInfo, OtherResourceInfo, OtherResourceSource},
  },
  tasks::{commands::schedule_progressive_task_group, download::DownloadParam, RuntimeTaskParam},
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
pub async fn fetch_game_version_specific(
  app: AppHandle,
  state: State<'_, Mutex<LauncherConfig>>,
  game_version: String,
) -> SJMCLResult<GameClientResourceInfo> {
  let all_versions = fetch_game_version_list(app.clone(), state).await?;

  all_versions
    .into_iter()
    .find(|item| item.id == game_version)
    .ok_or_else(|| ResourceError::ClientVersionNotFound.into())
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
  download_source: OtherResourceSource,
  query: OtherResourceSearchQuery,
) -> SJMCLResult<OtherResourceSearchRes> {
  match download_source {
    OtherResourceSource::CurseForge => {
      Ok(fetch_resource_list_by_name_curseforge(&app, &query).await?)
    }
    OtherResourceSource::Modrinth => Ok(fetch_resource_list_by_name_modrinth(&app, &query).await?),
    _ => Err(ResourceError::NoDownloadApi.into()),
  }
}

#[tauri::command]
pub async fn fetch_resource_version_packs(
  app: AppHandle,
  download_source: OtherResourceSource,
  query: OtherResourceVersionPackQuery,
) -> SJMCLResult<Vec<OtherResourceVersionPack>> {
  match download_source {
    OtherResourceSource::CurseForge => {
      Ok(fetch_resource_version_packs_curseforge(&app, &query).await?)
    }
    OtherResourceSource::Modrinth => Ok(fetch_resource_version_packs_modrinth(&app, &query).await?),
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
    format!("game-server?{}", resource_info.id),
    vec![RuntimeTaskParam::Download(DownloadParam {
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

#[tauri::command]
pub async fn fetch_remote_resource_by_local(
  app: AppHandle,
  download_source: OtherResourceSource,
  file_path: String,
) -> SJMCLResult<OtherResourceFileInfo> {
  match download_source {
    OtherResourceSource::CurseForge => {
      Ok(fetch_remote_resource_by_local_curseforge(&app, &file_path).await?)
    }
    OtherResourceSource::Modrinth => {
      Ok(fetch_remote_resource_by_local_modrinth(&app, &file_path).await?)
    }
    _ => Err(ResourceError::NoDownloadApi.into()),
  }
}

#[tauri::command]
pub async fn update_mods(
  app: AppHandle,
  instance_id: String,
  queries: Vec<ModUpdateQuery>,
) -> SJMCLResult<()> {
  if queries.is_empty() {
    return Ok(());
  }

  let mods_dir = match get_instance_subdir_path_by_id(&app, &instance_id, &InstanceSubdirType::Mods)
  {
    Some(path) => path,
    None => return Ok(()),
  };

  let mut download_tasks = Vec::new();
  for query in &queries {
    let file_path = mods_dir.join(&query.file_name);
    let download_param = DownloadParam {
      src: url::Url::parse(&query.url).map_err(|_| ResourceError::ParseError)?,
      dest: file_path,
      filename: None,
      sha1: Some(query.sha1.clone()),
    };
    download_tasks.push(RuntimeTaskParam::Download(download_param));
  }
  schedule_progressive_task_group(app, "mod-update".to_string(), download_tasks, true).await?;

  for query in &queries {
    let old_file_path = &query.old_file_path;
    let new_file_path = mods_dir.join(&query.file_name);

    if old_file_path != &new_file_path.to_string_lossy().to_string() {
      let old_backup_path = format!("{}.old", old_file_path);
      if let Err(e) = std::fs::rename(old_file_path, &old_backup_path) {
        log::error!("Failed to rename old mod file: {}", e);
        return Err(ResourceError::FileOperationError.into());
      }
    }
  }

  Ok(())
}

#[tauri::command]
pub async fn fetch_remote_resource_by_id(
  app: AppHandle,
  download_source: OtherResourceSource,
  resource_id: String,
) -> SJMCLResult<OtherResourceInfo> {
  match download_source {
    OtherResourceSource::CurseForge => {
      Ok(fetch_remote_resource_by_id_curseforge(&app, &resource_id).await?)
    }
    OtherResourceSource::Modrinth => {
      Ok(fetch_remote_resource_by_id_modrinth(&app, &resource_id).await?)
    }
    _ => Err(ResourceError::NoDownloadApi.into()),
  }
}
