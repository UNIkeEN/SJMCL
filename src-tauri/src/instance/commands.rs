use super::helpers::loader::fabric::remove_fabric_api_mods;
use crate::error::SJMCLResult;
use crate::instance::constants::TRANSLATION_CACHE_EXPIRY_HOURS;
use crate::instance::helpers::client_json::{replace_native_libraries, McClientInfo};
use crate::instance::helpers::game_version::{build_game_version_cmp_fn, compare_game_versions};
use crate::instance::helpers::loader::common::{execute_processors, install_mod_loader};
use crate::instance::helpers::loader::forge::InstallProfile;
use crate::instance::helpers::loader::optifine::{
  download_optifine_installer, finish_optifine_install,
};
use crate::instance::helpers::misc::{
  get_instance_game_config, get_instance_subdir_path_by_id, get_instance_subdir_paths,
  refresh_and_update_instances, unify_instance_name,
};
use crate::instance::helpers::modpack::misc::{
  extract_overrides, get_download_params, ModpackMetaInfo,
};
use crate::instance::helpers::mods::common::{
  add_local_mod_translations, compress_icon, get_mod_info_from_dir, get_mod_info_from_jar,
  LocalModTranslationEntry, LocalModTranslationsCache,
};
use crate::instance::helpers::options_txt::get_zh_hans_lang_tag;
use crate::instance::helpers::resourcepack::{
  load_resourcepack_from_dir, load_resourcepack_from_zip,
};
use crate::instance::helpers::server::{
  load_servers_info_from_path, query_servers_online, GameServerInfo,
};
use crate::instance::helpers::world::{load_level_data_from_nbt, load_world_info_from_dir};
use crate::instance::models::misc::{
  Instance, InstanceError, InstanceSubdirType, InstanceSummary, LocalModInfo, ModLoader,
  ModLoaderStatus, ModLoaderType, OptiFine, ResourcePackInfo, SchematicInfo, ScreenshotInfo,
  ShaderPackInfo,
};
use crate::instance::models::world::base::WorldInfo;
use crate::instance::models::world::level::LevelData;
use crate::launch::helpers::file_validator::{get_invalid_assets, get_invalid_library_files};
use crate::launcher_config::helpers::misc::get_global_game_config;
use crate::launcher_config::models::{GameConfig, GameDirectory, LauncherConfig};
use crate::partial::{PartialError, PartialUpdate};
use crate::resource::helpers::misc::get_source_priority_list;
use crate::resource::models::{
  GameClientResourceInfo, ModLoaderResourceInfo, OptiFineResourceInfo,
};
use crate::storage::{load_json_async, save_json_async, Storage};
use crate::tasks::commands::schedule_progressive_task_group;
use crate::tasks::download::DownloadParam;
use crate::tasks::PTaskParam;
use crate::utils::fs::{
  copy_whole_dir, create_url_shortcut, generate_unique_filename, get_files_with_regex,
  get_subdirectories,
};
use crate::utils::image::ImageWrapper;
use lazy_static::lazy_static;
use regex::{Regex, RegexBuilder};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use tauri::State;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use tokio;
use tokio::sync::Semaphore;
use url::Url;
use zip::read::ZipArchive;

#[tauri::command]
pub async fn retrieve_instance_list(app: AppHandle) -> SJMCLResult<Vec<InstanceSummary>> {
  refresh_and_update_instances(&app, false).await; // firstly refresh and update
  let global_version_isolation = get_global_game_config(&app).version_isolation;
  let mut summary_list = Vec::new();

  let instance_binding = app.state::<Mutex<HashMap<String, Instance>>>();
  let instances = instance_binding.lock().unwrap().clone();
  for (id, instance) in instances.iter() {
    // same as get_game_config(), but mannually here
    let is_version_isolated =
      if instance.use_spec_game_config && instance.spec_game_config.is_some() {
        instance
          .spec_game_config
          .as_ref()
          .unwrap()
          .version_isolation
      } else {
        global_version_isolation
      };

    summary_list
      .push(InstanceSummary::from_instance(&app, id.clone(), instance, is_version_isolated).await);
  }

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;
  // sort instances (starred instance will be pinned to top by frontend)
  let version_cmp_fn = build_game_version_cmp_fn(&app);
  match config_state.states.all_instances_page.sort_by.as_str() {
    "versionAsc" => {
      summary_list.sort_by(|a, b| version_cmp_fn(&a.version, &b.version));
    }
    "versionDesc" => {
      summary_list.sort_by(|a, b| version_cmp_fn(&b.version, &a.version));
    }
    _ => {
      summary_list.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    }
  }

  // ensure an instance is selected if instance list is not empty
  if !summary_list.is_empty()
    && !summary_list
      .iter()
      .any(|instance| instance.id == config_state.states.shared.selected_instance_id)
  {
    config_state.partial_update(
      &app,
      "states.shared.selected_instance_id",
      &serde_json::to_string(&summary_list[0].id).unwrap_or_default(),
    )?;
    config_state.save()?;
  }

  Ok(summary_list)
}

#[tauri::command]
pub async fn update_instance_config(
  app: AppHandle,
  instance_id: String,
  key_path: String,
  value: String,
) -> SJMCLResult<()> {
  let instance = {
    let binding = app.state::<Mutex<HashMap<String, Instance>>>();
    let mut state = binding.lock().unwrap();
    let instance = state
      .get_mut(&instance_id)
      .ok_or(InstanceError::InstanceNotFoundByID)?;
    let key_path = {
      let mut snake = String::new();
      for (i, ch) in key_path.char_indices() {
        if i > 0 && ch.is_uppercase() {
          snake.push('_');
        }
        snake.push(ch.to_ascii_lowercase());
      }
      snake
    };
    // PartialUpdate not support Option<T> yet
    if key_path == "description" {
      instance.description = serde_json::from_str::<String>(&value).unwrap_or(value);
    } else if key_path == "icon_src" {
      instance.icon_src = serde_json::from_str::<String>(&value).unwrap_or(value);
    } else if key_path == "starred" {
      instance.starred = value.parse::<bool>()?;
    } else if key_path == "use_spec_game_config" {
      let value = value.parse::<bool>()?;
      instance.use_spec_game_config = value;
      if value && instance.spec_game_config.is_none() {
        instance.spec_game_config = Some(get_global_game_config(&app));
      }
    } else if key_path.starts_with("spec_game_config.") {
      let key = key_path.split_at("spec_game_config.".len()).1;
      let game_config = instance.spec_game_config.as_mut().unwrap();
      game_config.update(key, &value)?;
    } else {
      return Err(PartialError::NotFound.into());
    }
    instance.clone()
  };
  instance.save_json_cfg().await?;
  Ok(())
}

#[tauri::command]
pub fn retrieve_instance_game_config(
  app: AppHandle,
  instance_id: String,
) -> SJMCLResult<GameConfig> {
  let binding = app.state::<Mutex<HashMap<String, Instance>>>();
  let state = binding.lock().unwrap();
  let instance = state
    .get(&instance_id)
    .ok_or(InstanceError::InstanceNotFoundByID)?;

  Ok(get_instance_game_config(&app, instance))
}

#[tauri::command]
pub async fn reset_instance_game_config(app: AppHandle, instance_id: String) -> SJMCLResult<()> {
  let instance = {
    let binding = app.state::<Mutex<HashMap<String, Instance>>>();
    let mut state = binding.lock().unwrap();
    let instance = state
      .get_mut(&instance_id)
      .ok_or(InstanceError::InstanceNotFoundByID)?;
    instance.spec_game_config = Some(get_global_game_config(&app));
    instance.clone()
  };
  instance.save_json_cfg().await?;
  Ok(())
}

#[tauri::command]
pub fn retrieve_instance_subdir_path(
  app: AppHandle,
  instance_id: String,
  dir_type: InstanceSubdirType,
) -> SJMCLResult<PathBuf> {
  match get_instance_subdir_path_by_id(&app, &instance_id, &dir_type) {
    Some(path) => Ok(path),
    None => Err(InstanceError::InstanceNotFoundByID.into()),
  }
}

#[tauri::command]
pub fn delete_instance(app: AppHandle, instance_id: String) -> SJMCLResult<()> {
  let instance_binding = app.state::<Mutex<HashMap<String, Instance>>>();
  let instance_state = instance_binding.lock().unwrap();

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock()?;

  let instance = instance_state
    .get(&instance_id)
    .ok_or(InstanceError::InstanceNotFoundByID)?;

  let version_path = &instance.version_path;
  let path = Path::new(version_path);

  if path.exists() {
    fs::remove_dir_all(path)?;
  }
  // not update state here. if send success to frontend, it will call retrieve_instance_list and update state there.

  if config_state.states.shared.selected_instance_id == instance_id {
    config_state.partial_update(
      &app,
      "states.shared.selected_instance_id",
      &serde_json::to_string(
        &instance_state
          .keys()
          .next()
          .cloned()
          .unwrap_or_else(|| "".to_string()),
      )
      .unwrap_or_default(),
    )?;
    config_state.save()?;
  }
  Ok(())
}

#[tauri::command]
pub async fn rename_instance(
  app: AppHandle,
  instance_id: String,
  new_name: String,
) -> SJMCLResult<PathBuf> {
  let binding = app.state::<Mutex<HashMap<String, Instance>>>();
  let mut state = binding.lock().unwrap();
  let instance = match state.get_mut(&instance_id) {
    Some(x) => x,
    None => return Err(InstanceError::InstanceNotFoundByID.into()),
  };
  let new_path = unify_instance_name(&instance.version_path, &new_name)?;

  instance.version_path = new_path.clone();
  instance.name = new_name;
  Ok(new_path)
}

#[tauri::command]
pub fn copy_resource_to_instances(
  app: AppHandle,
  src_file_path: String,
  tgt_inst_ids: Vec<String>,
  tgt_dir_type: InstanceSubdirType,
  decompress: bool,
) -> SJMCLResult<()> {
  let src_path = Path::new(&src_file_path);

  if src_path.is_file() {
    let file_name = src_path
      .file_name()
      .ok_or(InstanceError::InvalidSourcePath)?;

    for tgt_inst_id in tgt_inst_ids {
      let tgt_path = match get_instance_subdir_path_by_id(&app, &tgt_inst_id, &tgt_dir_type) {
        Some(path) => path,
        None => return Err(InstanceError::InstanceNotFoundByID.into()),
      };

      if !tgt_path.exists() {
        fs::create_dir_all(&tgt_path).map_err(|_| InstanceError::FolderCreationFailed)?;
      }

      if decompress {
        let base_name = src_path
          .extension()
          .and_then(|ext| if ext == "zip" { Some(()) } else { None })
          .and_then(|_| Path::new(file_name).file_stem())
          .unwrap_or(file_name);
        let dest_path = generate_unique_filename(&tgt_path, base_name);

        // extract zip
        let file = fs::File::open(src_path).map_err(|_| InstanceError::ZipFileProcessFailed)?;
        let mut archive = ZipArchive::new(file).map_err(|_| InstanceError::ZipFileProcessFailed)?;

        fs::create_dir_all(&dest_path).map_err(|_| InstanceError::FolderCreationFailed)?;

        archive
          .extract(&dest_path)
          .map_err(|_| InstanceError::ZipFileProcessFailed)?;
      } else {
        let dest_path = generate_unique_filename(&tgt_path, file_name);
        fs::copy(&src_file_path, &dest_path).map_err(|_| InstanceError::FileCopyFailed)?;
      }
    }
  } else if src_path.is_dir() {
    for tgt_inst_id in tgt_inst_ids {
      let tgt_path = match get_instance_subdir_path_by_id(&app, &tgt_inst_id, &tgt_dir_type) {
        Some(path) => path,
        None => return Err(InstanceError::InstanceNotFoundByID.into()),
      };

      if !tgt_path.exists() {
        fs::create_dir_all(&tgt_path).map_err(|_| InstanceError::FolderCreationFailed)?;
      }

      let dest_path = generate_unique_filename(&tgt_path, src_path.file_name().unwrap());
      copy_whole_dir(src_path, &dest_path).map_err(|_| InstanceError::FileCopyFailed)?;
    }
  } else {
    return Err(InstanceError::InvalidSourcePath.into());
  }
  Ok(())
}

#[tauri::command]
pub fn move_resource_to_instance(
  app: AppHandle,
  src_file_path: String,
  tgt_inst_id: String,
  tgt_dir_type: InstanceSubdirType,
) -> SJMCLResult<()> {
  let tgt_path = match get_instance_subdir_path_by_id(&app, &tgt_inst_id, &tgt_dir_type) {
    Some(path) => path,
    None => return Err(InstanceError::InstanceNotFoundByID.into()),
  };

  let src_path = Path::new(&src_file_path);
  if !src_path.is_dir() && !src_path.is_file() {
    return Err(InstanceError::InvalidSourcePath.into());
  }

  let file_name = src_path
    .file_name()
    .ok_or(InstanceError::InvalidSourcePath)?;

  if !tgt_path.exists() {
    fs::create_dir_all(&tgt_path).map_err(|_| InstanceError::FolderCreationFailed)?;
  }

  let dest_path = generate_unique_filename(&tgt_path, file_name);
  fs::rename(&src_file_path, &dest_path).map_err(|_| InstanceError::FileMoveFailed)?;
  Ok(())
}

#[tauri::command]
pub async fn retrieve_world_list(
  app: AppHandle,
  instance_id: String,
) -> SJMCLResult<Vec<WorldInfo>> {
  let game_version = {
    let binding = app.state::<Mutex<HashMap<String, Instance>>>();
    let state = binding.lock()?;
    let instance = state
      .get(&instance_id)
      .ok_or(InstanceError::InstanceNotFoundByID)?;
    instance.version.clone()
  };

  // difficulty setting was introduced in game version 14w02a
  let has_difficulty_support = compare_game_versions(&app, &game_version, "14w02a", false)
    .await
    .is_ge();

  let mut world_list: Vec<WorldInfo> = Vec::new();

  let worlds_dir =
    match get_instance_subdir_path_by_id(&app, &instance_id, &InstanceSubdirType::Saves) {
      Some(path) => path,
      None => return Ok(Vec::new()),
    };
  if let Ok(world_paths) = get_subdirectories(worlds_dir) {
    for path in world_paths {
      if let Ok(info) = load_world_info_from_dir(&path, has_difficulty_support).await {
        world_list.push(info);
      }
    }
  }

  Ok(world_list)
}

#[tauri::command]
pub async fn retrieve_game_server_list(
  app: AppHandle,
  instance_id: String,
  query_online: bool,
) -> SJMCLResult<Vec<GameServerInfo>> {
  // query_online is false, return local data from nbt (servers.dat)
  let game_root_dir =
    match get_instance_subdir_path_by_id(&app, &instance_id, &InstanceSubdirType::Root) {
      Some(path) => path,
      None => return Ok(Vec::new()),
    };

  let nbt_path = game_root_dir.join("servers.dat");
  let mut game_servers = match load_servers_info_from_path(&nbt_path).await {
    Ok(servers) => servers,
    Err(_) => return Err(InstanceError::ServerNbtReadError.into()),
  };

  // skip hidden servers
  game_servers.retain(|server| !server.hidden);

  // query_online is true, amend query and return player count and online status
  if query_online {
    game_servers = query_servers_online(game_servers).await?;
  }

  Ok(game_servers)
}

#[tauri::command]
pub async fn retrieve_local_mod_list(
  app: AppHandle,
  instance_id: String,
  local_mod_translations_cache_state: State<'_, Mutex<LocalModTranslationsCache>>,
) -> SJMCLResult<Vec<LocalModInfo>> {
  let mods_dir = match get_instance_subdir_path_by_id(&app, &instance_id, &InstanceSubdirType::Mods)
  {
    Some(path) => path,
    None => return Ok(Vec::new()),
  };

  let valid_extensions = RegexBuilder::new(r"\.(jar|zip)(\.disabled)*$")
    .case_insensitive(true)
    .build()
    .unwrap();

  let mod_paths = get_files_with_regex(&mods_dir, &valid_extensions).unwrap_or_default();
  let mut tasks = Vec::new();
  let semaphore = Arc::new(Semaphore::new(
    std::thread::available_parallelism().unwrap().into(),
  ));
  for path in mod_paths {
    let permit = semaphore
      .clone()
      .acquire_owned()
      .await
      .map_err(|_| InstanceError::SemaphoreAcquireFailed)?;
    let task = tokio::spawn(async move {
      log::debug!("Load mod info from dir: {}", path.display());
      let info = get_mod_info_from_jar(&path).await.ok();
      drop(permit);
      info
    });
    tasks.push(task);
  }
  #[cfg(debug_assertions)]
  {
    // mod information detection from folders is only used for debugging.
    let mod_paths = get_subdirectories(&mods_dir).unwrap_or_default();
    for path in mod_paths {
      let permit = semaphore
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| InstanceError::SemaphoreAcquireFailed)?;
      let task = tokio::spawn(async move {
        log::debug!("Load mod info from dir: {}", path.display());
        let info = get_mod_info_from_dir(&path).await.ok();
        drop(permit);
        info
      });
      tasks.push(task);
    }
  }
  let mut mod_infos = Vec::new();
  for task in tasks {
    if let Ok(Some(mod_info)) = task.await {
      mod_infos.push(mod_info);
    }
  }

  // check potential incompatibility
  let incompatible_loader_type = {
    let binding = app.state::<Mutex<HashMap<String, Instance>>>();
    let state = binding.lock().unwrap();
    let instance = state
      .get(&instance_id)
      .ok_or(InstanceError::InstanceNotFoundByID)?;

    if instance.mod_loader.loader_type != ModLoaderType::Unknown {
      Some(instance.mod_loader.loader_type.clone())
    } else {
      None
    }
  };

  mod_infos.iter_mut().for_each(|mod_info| {
    if let Some(loader_type) = &incompatible_loader_type {
      mod_info.potential_incompatibility = mod_info.loader_type != *loader_type;
    } else {
      mod_info.potential_incompatibility = false;
    }
  });

  // Add translations for mod names and descriptions concurrently
  let mut translation_tasks = Vec::new();
  for mut mod_info in mod_infos {
    let app = app.clone();
    let permit = semaphore
      .clone()
      .acquire_owned()
      .await
      .map_err(|_| InstanceError::SemaphoreAcquireFailed)?;
    let task = tokio::spawn(async move {
      log::debug!("Translating mod: {}", mod_info.file_name);
      let _ = add_local_mod_translations(&app, &mut mod_info).await;
      drop(permit);
      mod_info
    });
    translation_tasks.push(task);
  }
  let mut mod_infos = Vec::new();
  for task in translation_tasks {
    if let Ok(mod_info) = task.await {
      mod_infos.push(mod_info);
    }
  }
  // sort by name (and version)
  mod_infos.sort();
  let mut cache = local_mod_translations_cache_state.lock()?;
  for info in mod_infos.iter() {
    if let Some(entry) = cache.translations.get(&info.file_name) {
      if !entry.is_expired(TRANSLATION_CACHE_EXPIRY_HOURS) {
        continue;
      }
    }
    cache.translations.insert(
      info.file_name.clone(),
      LocalModTranslationEntry::new(
        info.translated_name.clone(),
        info.translated_description.clone(),
      ),
    );
  }
  cache.save()?;

  Ok(mod_infos)
}

#[tauri::command]
pub async fn retrieve_resource_pack_list(
  app: AppHandle,
  instance_id: String,
) -> SJMCLResult<Vec<ResourcePackInfo>> {
  // Get the resource packs list based on the instance
  let resource_packs_dir =
    match get_instance_subdir_path_by_id(&app, &instance_id, &InstanceSubdirType::ResourcePacks) {
      Some(path) => path,
      None => return Ok(Vec::new()),
    };
  let mut info_list: Vec<ResourcePackInfo> = Vec::new();

  let valid_extensions = RegexBuilder::new(r"\.zip$")
    .case_insensitive(true)
    .build()
    .unwrap();

  for path in get_files_with_regex(&resource_packs_dir, &valid_extensions).unwrap_or(vec![]) {
    if let Ok((description, icon_src)) = load_resourcepack_from_zip(&path) {
      let name = match path.file_stem() {
        Some(stem) => stem.to_string_lossy().to_string(),
        None => String::new(),
      };
      info_list.push(ResourcePackInfo {
        name,
        description,
        icon_src: icon_src.map(ImageWrapper::from).map(compress_icon),
        file_path: path.clone(),
      });
    }
  }

  for path in get_subdirectories(&resource_packs_dir).unwrap_or(vec![]) {
    if let Ok((description, icon_src)) = load_resourcepack_from_dir(&path).await {
      let name = match path.file_stem() {
        Some(stem) => stem.to_string_lossy().to_string(),
        None => String::new(),
      };
      info_list.push(ResourcePackInfo {
        name,
        description,
        icon_src: icon_src.map(ImageWrapper::from).map(compress_icon),
        file_path: path.clone(),
      });
    }
  }
  Ok(info_list)
}

#[tauri::command]
pub async fn retrieve_server_resource_pack_list(
  app: AppHandle,
  instance_id: String,
) -> SJMCLResult<Vec<ResourcePackInfo>> {
  let resource_packs_dir = match get_instance_subdir_path_by_id(
    &app,
    &instance_id,
    &InstanceSubdirType::ServerResourcePacks,
  ) {
    Some(path) => path,
    None => return Ok(Vec::new()),
  };
  let mut info_list: Vec<ResourcePackInfo> = Vec::new();

  let valid_extensions = RegexBuilder::new(r".*")
    .case_insensitive(true)
    .build()
    .unwrap();

  for path in get_files_with_regex(&resource_packs_dir, &valid_extensions).unwrap_or(vec![]) {
    if let Ok((description, icon_src)) = load_resourcepack_from_zip(&path) {
      let name = match path.file_stem() {
        Some(stem) => stem.to_string_lossy().to_string(),
        None => String::new(),
      };
      info_list.push(ResourcePackInfo {
        name,
        description,
        icon_src: icon_src.map(ImageWrapper::from).map(compress_icon),
        file_path: path.clone(),
      });
    }
  }

  for path in get_subdirectories(&resource_packs_dir).unwrap_or(vec![]) {
    if let Ok((description, icon_src)) = load_resourcepack_from_dir(&path).await {
      let name = match path.file_stem() {
        Some(stem) => stem.to_string_lossy().to_string(),
        None => String::new(),
      };

      info_list.push(ResourcePackInfo {
        name,
        description,
        icon_src: icon_src.map(ImageWrapper::from).map(compress_icon),
        file_path: path.clone(),
      });
    }
  }
  Ok(info_list)
}

#[tauri::command]
pub fn retrieve_schematic_list(
  app: AppHandle,
  instance_id: String,
) -> SJMCLResult<Vec<SchematicInfo>> {
  let schematics_dir =
    match get_instance_subdir_path_by_id(&app, &instance_id, &InstanceSubdirType::Schematics) {
      Some(path) => path,
      None => return Ok(Vec::new()),
    };

  if !schematics_dir.exists() {
    return Ok(Vec::new());
  }
  let valid_extensions = RegexBuilder::new(r"\.(litematic|schematic)$")
    .case_insensitive(true)
    .build()
    .unwrap();
  let mut schematic_list = Vec::new();
  for schematic_path in get_files_with_regex(schematics_dir.as_path(), &valid_extensions)? {
    schematic_list.push(SchematicInfo {
      name: schematic_path
        .file_stem()
        .unwrap()
        .to_string_lossy()
        .to_string(),
      file_path: schematic_path,
    });
  }

  Ok(schematic_list)
}

#[tauri::command]
pub fn retrieve_shader_pack_list(
  app: AppHandle,
  instance_id: String,
) -> SJMCLResult<Vec<ShaderPackInfo>> {
  // Get the shaderpacks directory based on the instance
  let shaderpacks_dir =
    match get_instance_subdir_path_by_id(&app, &instance_id, &InstanceSubdirType::ShaderPacks) {
      Some(path) => path,
      None => return Ok(Vec::new()),
    };

  if !shaderpacks_dir.exists() {
    return Ok(Vec::new());
  }

  let valid_extensions = RegexBuilder::new(r"\.zip$")
    .case_insensitive(true)
    .build()
    .unwrap();
  let mut shaderpack_list = Vec::new();
  for path in get_files_with_regex(shaderpacks_dir, &valid_extensions)? {
    shaderpack_list.push(ShaderPackInfo {
      file_name: path.file_stem().unwrap().to_string_lossy().to_string(),
      file_path: path,
    });
  }

  Ok(shaderpack_list)
}

#[tauri::command]
pub fn retrieve_screenshot_list(
  app: AppHandle,
  instance_id: String,
) -> SJMCLResult<Vec<ScreenshotInfo>> {
  let screenshots_dir =
    match get_instance_subdir_path_by_id(&app, &instance_id, &InstanceSubdirType::Screenshots) {
      Some(path) => path,
      None => return Ok(Vec::new()),
    };

  if !screenshots_dir.exists() {
    return Ok(Vec::new());
  }

  // The default screenshot format in Minecraft is PNG. For broader compatibility, JPG and JPEG formats are also included here.
  let valid_extensions = RegexBuilder::new(r"\.(jpg|jpeg|png)$")
    .case_insensitive(true)
    .build()
    .unwrap();
  let mut screenshot_list = Vec::new();
  for path in get_files_with_regex(screenshots_dir, &valid_extensions)? {
    let metadata = path.metadata().unwrap();
    let modified_time = metadata.modified().unwrap();
    let timestamp = modified_time
      .duration_since(SystemTime::UNIX_EPOCH)
      .unwrap()
      .as_secs();
    screenshot_list.push(ScreenshotInfo {
      file_name: path.file_stem().unwrap().to_string_lossy().to_string(),
      file_path: path,
      time: timestamp,
    });
  }

  Ok(screenshot_list)
}

lazy_static! {
  static ref RENAME_LOCK: Mutex<()> = Mutex::new(());
  static ref RENAME_REGEX: Regex = RegexBuilder::new(r"^(.*?)(\.disabled)*$")
    .case_insensitive(true)
    .build()
    .unwrap();
}

#[tauri::command]
pub fn toggle_mod_by_extension(file_path: PathBuf, enable: bool) -> SJMCLResult<()> {
  let _lock = RENAME_LOCK.lock().expect("Failed to acquire lock");
  if !file_path.is_file() {
    return Err(InstanceError::FileNotFoundError.into());
  }

  let file_name = file_path
    .file_name()
    .unwrap_or_default()
    .to_str()
    .unwrap_or_default();

  let new_name = if enable {
    if let Some(captures) = RENAME_REGEX.captures(file_name) {
      captures
        .get(1)
        .map(|m| m.as_str())
        .unwrap_or(file_name)
        .to_string()
    } else {
      file_name.to_string()
    }
  } else if RENAME_REGEX.is_match(file_name) {
    format!("{}.disabled", file_name)
  } else {
    file_name.to_string()
  };
  let new_path = file_path.with_file_name(new_name);

  if new_path != file_path {
    fs::rename(&file_path, &new_path)?;
  }

  Ok(())
}

#[tauri::command]
pub async fn retrieve_world_details(
  app: AppHandle,
  instance_id: String,
  world_name: String,
) -> SJMCLResult<LevelData> {
  let worlds_dir =
    match get_instance_subdir_path_by_id(&app, &instance_id, &InstanceSubdirType::Saves) {
      Some(path) => path,
      None => return Err(InstanceError::WorldNotExistError.into()),
    };
  let level_path = worlds_dir.join(world_name).join("level.dat");
  if tokio::fs::metadata(&level_path).await.is_err() {
    return Err(InstanceError::LevelNotExistError.into());
  }
  if let Ok(level_data) = load_level_data_from_nbt(&level_path).await {
    Ok(level_data)
  } else {
    Err(InstanceError::LevelParseError.into())
  }
}

#[tauri::command]
pub fn create_launch_desktop_shortcut(app: AppHandle, instance_id: String) -> SJMCLResult<()> {
  let binding = app.state::<Mutex<HashMap<String, Instance>>>();
  let state = binding
    .lock()
    .map_err(|_| InstanceError::InstanceNotFoundByID)?;
  let instance = state
    .get(&instance_id)
    .ok_or(InstanceError::InstanceNotFoundByID)?;

  let name = instance.name.clone();
  let encoded_id = url::form_urlencoded::Serializer::new(String::new())
    .append_pair("id", &instance.id)
    .finish()
    .replace("+", "%20");
  let url = format!("sjmcl://launch?{}", encoded_id);

  create_url_shortcut(&app, name, url, None).map_err(|_| InstanceError::ShortcutCreationFailed)?;

  Ok(())
}

#[tauri::command]
pub async fn create_instance(
  app: AppHandle,
  directory: GameDirectory,
  name: String,
  description: String,
  icon_src: String,
  game: GameClientResourceInfo,
  mod_loader: ModLoaderResourceInfo,
  optifine: Option<OptiFineResourceInfo>,
  modpack_path: Option<String>,
  is_install_fabric_api: Option<bool>,
) -> SJMCLResult<()> {
  let client = app.state::<reqwest::Client>();
  let launcher_config_state = app.state::<Mutex<LauncherConfig>>();
  // Get priority list
  let priority_list = {
    let launcher_config = launcher_config_state.lock()?;
    get_source_priority_list(&launcher_config)
  };

  // Ensure the instance name is unique
  let version_path = directory.dir.join("versions").join(&name);
  if version_path.exists() {
    return Err(InstanceError::ConflictNameError.into());
  }
  let optifine_info = optifine.as_ref().map(|info| OptiFine {
    filename: info.filename.clone(),
    version: format!("{}_{}", info.r#type, info.patch),
    status: ModLoaderStatus::NotDownloaded,
  });

  // Create instance config
  let instance = Instance {
    id: format!("{}:{}", directory.name, name.clone()),
    name: name.clone(),
    version: game.id.clone(),
    version_path: version_path.clone(),
    mod_loader: ModLoader {
      loader_type: mod_loader.loader_type.clone(),
      status: if matches!(
        mod_loader.loader_type,
        ModLoaderType::Unknown | ModLoaderType::Fabric
      ) {
        ModLoaderStatus::Installed
      } else {
        ModLoaderStatus::NotDownloaded
      },
      version: mod_loader.version.clone(),
      branch: mod_loader.branch.clone(),
    },
    optifine: optifine_info,
    description,
    icon_src,
    starred: false,
    play_time: 0,
    use_spec_game_config: false,
    spec_game_config: None,
  };

  // Download version info
  let mut version_info = client
    .get(&game.url)
    .send()
    .await
    .map_err(|_| InstanceError::NetworkError)?
    .json::<McClientInfo>()
    .await
    .map_err(|_| InstanceError::ClientJsonParseError)?;

  version_info.id = name.clone();
  version_info.jar = Some(name.clone());

  // convert vanilla version info to vanilla patch
  let mut vanilla_patch = version_info.clone();
  vanilla_patch.id = "game".to_string();
  vanilla_patch.version = Some(game.id.clone());
  vanilla_patch.inherits_from = None;
  vanilla_patch.priority = Some(0);
  version_info.patches.push(vanilla_patch);

  let mut task_params = Vec::<PTaskParam>::new();

  // Download client (use task)
  let client_download_info = version_info
    .downloads
    .get("client")
    .ok_or(InstanceError::ClientJsonParseError)?;

  task_params.push(PTaskParam::Download(DownloadParam {
    src: Url::parse(&client_download_info.url.clone())
      .map_err(|_| InstanceError::ClientJsonParseError)?,
    dest: instance.version_path.join(format!("{}.jar", name)),
    filename: None,
    sha1: Some(client_download_info.sha1.clone()),
  }));
  let subdirs = get_instance_subdir_paths(
    &app,
    &instance,
    &[
      &InstanceSubdirType::Libraries,
      &InstanceSubdirType::Assets,
      &InstanceSubdirType::Mods,
    ],
  )
  .ok_or(InstanceError::InstanceNotFoundByID)?;
  let [libraries_dir, assets_dir, mods_dir] = subdirs.as_slice() else {
    return Err(InstanceError::InstanceNotFoundByID.into());
  };

  replace_native_libraries(&app, &mut version_info, &instance)
    .await
    .map_err(|_| InstanceError::ClientJsonParseError)?;

  // We only download libraries if they are invalid (not already downloaded)
  task_params.extend(
    get_invalid_library_files(priority_list[0], libraries_dir, &version_info, false).await?,
  );

  // We only download assets if they are invalid (not already downloaded)
  task_params
    .extend(get_invalid_assets(&app, &version_info, priority_list[0], assets_dir, false).await?);

  // download loader (installer)
  if instance.mod_loader.loader_type != ModLoaderType::Unknown {
    install_mod_loader(
      app.clone(),
      &priority_list,
      &instance.version,
      &instance.mod_loader,
      libraries_dir.to_path_buf(),
      mods_dir.to_path_buf(),
      &mut version_info,
      &mut task_params,
      is_install_fabric_api,
    )
    .await?;
  }

  if let Some(info) = optifine.as_ref() {
    download_optifine_installer(
      &instance.version,
      info,
      libraries_dir.to_path_buf(),
      &mut task_params,
    )
    .await?;
  }

  // If modpack path is provided, install it
  if let Some(modpack_path) = modpack_path {
    let path = PathBuf::from(modpack_path);
    let file = fs::File::open(&path).map_err(|_| InstanceError::FileNotFoundError)?;
    task_params.extend(get_download_params(&app, &file, &version_path).await?);
    extract_overrides(&file, &version_path)?;
  }

  schedule_progressive_task_group(
    app.clone(),
    format!("game-client?{}", name),
    task_params,
    true,
  )
  .await?;

  // Optionally skip first-screen options by adding options.txt (available for zh-Hans only)
  let (language, skip_first_screen_options) = {
    let launcher_config = launcher_config_state.lock()?;
    (
      launcher_config.general.general.language.clone(),
      launcher_config
        .general
        .functionality
        .skip_first_screen_options,
    )
  };
  if language == "zh-Hans" && skip_first_screen_options {
    if let Some(lang_code) = get_zh_hans_lang_tag(&instance.version, &app).await {
      let options_path = get_instance_subdir_paths(&app, &instance, &[&InstanceSubdirType::Root])
        .ok_or(InstanceError::InstanceNotFoundByID)?[0]
        .join("options.txt");
      if !options_path.exists() {
        fs::write(options_path, format!("lang:{}\n", lang_code))
          .map_err(|_| InstanceError::FileCreationFailed)?;
      }
    }
  }

  // Save the edited client json
  save_json_async(&version_info, &version_path.join(format!("{}.json", name))).await?;
  // Save the SJMCL instance config json
  instance
    .save_json_cfg()
    .await
    .map_err(|_| InstanceError::FileCreationFailed)?;

  Ok(())
}

#[tauri::command]
pub async fn finish_mod_loader_install(app: AppHandle, instance_id: String) -> SJMCLResult<()> {
  let instance = {
    let binding = app.state::<Mutex<HashMap<String, Instance>>>();
    let state = binding.lock()?;
    state
      .get(&instance_id)
      .ok_or(InstanceError::InstanceNotFoundByID)?
      .clone()
  };

  match instance.mod_loader.status {
    // prevent duplicated installation
    ModLoaderStatus::DownloadFailed => {
      return Err(InstanceError::ProcessorExecutionFailed.into());
    }
    ModLoaderStatus::Installing => {
      return Err(InstanceError::InstallationDuplicated.into());
    }
    ModLoaderStatus::Installed => {
      return Ok(());
    }
    _ => {}
  }

  {
    let binding = app.state::<Mutex<HashMap<String, Instance>>>();
    let mut state = binding.lock()?;
    let instance = state
      .get_mut(&instance_id)
      .ok_or(InstanceError::InstanceNotFoundByID)?;
    instance.mod_loader.status = ModLoaderStatus::Installing;
  };

  let client_info_dir = instance
    .version_path
    .join(format!("{}.json", instance.name));
  let client_info = load_json_async::<McClientInfo>(&client_info_dir).await?;

  let install_profile_dir = instance.version_path.join("install_profile.json");
  if install_profile_dir.exists() {
    let install_profile = load_json_async::<InstallProfile>(&install_profile_dir).await?;
    execute_processors(&app, &instance, &client_info, &install_profile).await?;
  }

  if let Some(optifine) = &instance.optifine {
    match optifine.status {
      // prevent duplicated installation
      ModLoaderStatus::DownloadFailed => {
        return Err(InstanceError::ProcessorExecutionFailed.into());
      }
      ModLoaderStatus::Installing => {
        return Err(InstanceError::InstallationDuplicated.into());
      }
      ModLoaderStatus::Installed => {
        return Ok(());
      }
      _ => {}
    }
    {
      let binding = app.state::<Mutex<HashMap<String, Instance>>>();
      let mut state = binding.lock()?;
      let instance = state
        .get_mut(&instance_id)
        .ok_or(InstanceError::InstanceNotFoundByID)?;
      instance.optifine.as_mut().unwrap().status = ModLoaderStatus::Installing;
    };
    finish_optifine_install(&app, &instance, &client_info).await?;
  }

  let instance = {
    let binding = app.state::<Mutex<HashMap<String, Instance>>>();
    let mut state = binding.lock()?;
    let instance = state
      .get_mut(&instance_id)
      .ok_or(InstanceError::InstanceNotFoundByID)?;
    instance.mod_loader.status = ModLoaderStatus::Installed;
    if let Some(optifine) = &mut instance.optifine {
      optifine.status = ModLoaderStatus::Installed;
    }
    instance.clone()
  };
  instance.save_json_cfg().await?;

  Ok(())
}

#[tauri::command]
pub async fn check_change_mod_loader_availablity(
  app: AppHandle,
  instance_id: String,
) -> SJMCLResult<bool> {
  let instance = {
    let binding = app.state::<Mutex<HashMap<String, Instance>>>();
    let launcher_config_state = binding.lock()?;
    launcher_config_state
      .get(&instance_id)
      .ok_or(InstanceError::InstanceNotFoundByID)?
      .clone()
  };

  let json_path = instance
    .version_path
    .join(format!("{}.json", instance.name));
  if !json_path.exists() {
    return Err(InstanceError::NotSupportChangeModLoader.into());
  }

  let current_info: McClientInfo = load_json_async(&json_path)
    .await
    .map_err(|_| InstanceError::NotSupportChangeModLoader)?;

  if current_info.patches.is_empty() {
    return Err(InstanceError::NotSupportChangeModLoader.into());
  }

  Ok(true)
}

#[tauri::command]
pub async fn change_mod_loader(
  app: AppHandle,
  instance_id: String,
  new_mod_loader: ModLoaderResourceInfo,
  is_install_fabric_api: Option<bool>,
) -> SJMCLResult<()> {
  let mut instance = {
    let binding = app.state::<Mutex<HashMap<String, Instance>>>();
    let state = binding.lock()?;
    state
      .get(&instance_id)
      .ok_or(InstanceError::InstanceNotFoundByID)?
      .clone()
  };
  let version_isolation = get_instance_game_config(&app, &instance).version_isolation;
  // Get priority list
  let priority_list = {
    let launcher_config_state = app.state::<Mutex<LauncherConfig>>();
    let launcher_config = launcher_config_state.lock()?;
    get_source_priority_list(&launcher_config)
  };

  // load current version info
  let json_path = instance
    .version_path
    .join(format!("{}.json", instance.name));
  let current_info: McClientInfo = load_json_async(&json_path).await?;
  let vanilla_info = current_info
    .patches
    .first()
    .cloned()
    .ok_or(InstanceError::NotSupportChangeModLoader)?;

  let mod_loader = ModLoader {
    loader_type: new_mod_loader.loader_type.clone(),
    version: new_mod_loader.version.clone(),
    status: if matches!(
      new_mod_loader.loader_type,
      ModLoaderType::Unknown | ModLoaderType::Fabric
    ) {
      ModLoaderStatus::Installed
    } else {
      ModLoaderStatus::NotDownloaded
    },
    branch: new_mod_loader.branch.clone(),
  };
  let game_version = instance.version.clone();
  let subdirs = get_instance_subdir_paths(
    &app,
    &instance,
    &[&InstanceSubdirType::Libraries, &InstanceSubdirType::Mods],
  )
  .ok_or(InstanceError::InstanceNotFoundByID)?;
  let [libraries_dir, mods_dir] = subdirs.as_slice() else {
    return Err(InstanceError::InstanceNotFoundByID.into());
  };
  // Remove Fabric API mods if switching from Fabric modloader
  if instance.mod_loader.loader_type == ModLoaderType::Fabric && version_isolation {
    remove_fabric_api_mods(mods_dir).await?;
  }
  // construct new version info
  instance.mod_loader = mod_loader.clone();
  let mut version_info: McClientInfo = vanilla_info.clone();
  version_info.id = current_info.id.clone();
  version_info.jar = Some(instance.name.clone());
  version_info.java_version = current_info.java_version.clone();
  version_info.client_version = Some(instance.version.clone());
  version_info.patches = vec![vanilla_info];

  // install new mod loader
  let mut task_params: Vec<PTaskParam> = Vec::new();
  install_mod_loader(
    app.clone(),
    &priority_list,
    &game_version,
    &mod_loader,
    libraries_dir.to_path_buf(),
    mods_dir.to_path_buf(),
    &mut version_info,
    &mut task_params,
    is_install_fabric_api,
  )
  .await?;

  schedule_progressive_task_group(
    app.clone(),
    format!(
      "change-mod-loader?{} {}",
      mod_loader.loader_type, mod_loader.version
    ),
    task_params,
    true,
  )
  .await?;

  save_json_async(&version_info, &json_path).await?;
  instance
    .save_json_cfg()
    .await
    .map_err(|_| InstanceError::FileCreationFailed)?;

  Ok(())
}

#[tauri::command]
pub async fn retrieve_modpack_meta_info(
  app: AppHandle,
  path: String,
) -> SJMCLResult<ModpackMetaInfo> {
  let path = PathBuf::from(path);
  let file = fs::File::open(&path).map_err(|_| InstanceError::FileNotFoundError)?;
  ModpackMetaInfo::from_archive(&app, &file).await
}

#[tauri::command]
pub fn add_custom_instance_icon(
  app: AppHandle,
  instance_id: String,
  source_src: String,
) -> SJMCLResult<()> {
  let version_path = {
    let binding = app.state::<Mutex<HashMap<String, Instance>>>();
    let state = binding.lock()?;
    let instance = state
      .get(&instance_id)
      .ok_or(InstanceError::InstanceNotFoundByID)?;
    instance.version_path.clone()
  };

  let source_path = Path::new(&source_src);
  if !source_path.exists() || !source_path.is_file() {
    return Err(InstanceError::FileNotFoundError.into());
  }

  let dest_path = Path::new(&version_path).join("icon");
  fs::copy(source_path, &dest_path)?;

  Ok(())
}
