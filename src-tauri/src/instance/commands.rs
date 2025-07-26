use super::{
  super::utils::fs::{
    copy_whole_dir, generate_unique_filename, get_files_with_regex, get_subdirectories,
  },
  helpers::{
    game_version::get_major_game_version,
    misc::{
      get_instance_game_config, get_instance_subdir_path_by_id, refresh_and_update_instances,
      unify_instance_name,
    },
    mods::common::{get_mod_info_from_dir, get_mod_info_from_jar},
    resourcepack::{load_resourcepack_from_dir, load_resourcepack_from_zip},
    server::{load_servers_info_from_path, query_server_status},
    world::{level_data_to_world_info, load_level_data_from_path},
  },
  models::{
    misc::{
      GameServerInfo, Instance, InstanceError, InstanceSubdirType, InstanceSummary, LocalModInfo,
      ModLoaderType, ResourcePackInfo, SchematicInfo, ScreenshotInfo, ShaderPackInfo,
    },
    world::{base::WorldInfo, level::LevelData},
  },
};
use crate::{
  error::SJMCLResult,
  instance::{
    helpers::{
      client_json::{replace_native_libraries, McClientInfo, PatchesInfo},
      misc::get_instance_subdir_paths,
      mod_loader::{execute_processors, install_mod_loader},
      mods::forge::InstallProfile,
    },
    models::misc::{AssetIndex, ModLoader, ModLoaderStatus},
  },
  launch::helpers::file_validator::{get_invalid_assets, get_invalid_library_files},
  launcher_config::{
    helpers::misc::get_global_game_config,
    models::{GameConfig, GameDirectory, LauncherConfig},
  },
  partial::{PartialError, PartialUpdate},
  resource::{
    helpers::misc::get_source_priority_list,
    models::{GameClientResourceInfo, ModLoaderResourceInfo},
  },
  storage::{load_json_async, Storage},
  tasks::{commands::schedule_progressive_task_group, download::DownloadParam, PTaskParam},
  utils::{fs::create_url_shortcut, image::ImageWrapper},
};
use lazy_static::lazy_static;
use regex::{Regex, RegexBuilder};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::{sync::Mutex, time::SystemTime};
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use tokio;
use url::Url;
use zip::read::ZipArchive;

#[tauri::command]
pub async fn retrieve_instance_list(app: AppHandle) -> SJMCLResult<Vec<InstanceSummary>> {
  refresh_and_update_instances(&app, false).await; // firstly refresh and update
  let binding = app.state::<Mutex<HashMap<String, Instance>>>();
  let instances = binding.lock().unwrap().clone();
  let mut summary_list = Vec::new();
  let global_version_isolation = get_global_game_config(&app).version_isolation;
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

    summary_list.push(InstanceSummary {
      id: id.clone(),
      name: instance.name.clone(),
      description: instance.description.clone(),
      icon_src: instance.icon_src.clone(),
      starred: instance.starred,
      play_time: instance.play_time,
      version: instance.version.clone(),
      major_version: get_major_game_version(&app, &instance.version).await,
      version_path: instance.version_path.clone(),
      mod_loader: instance.mod_loader.clone(),
      use_spec_game_config: instance.use_spec_game_config,
      is_version_isolated,
    });
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
  let worlds_dir =
    match get_instance_subdir_path_by_id(&app, &instance_id, &InstanceSubdirType::Saves) {
      Some(path) => path,
      None => return Ok(Vec::new()),
    };

  let world_dirs = match get_subdirectories(worlds_dir) {
    Ok(val) => val,
    Err(_) => return Ok(Vec::new()), // if dir not exists, no need to error
  };

  let mut world_list: Vec<WorldInfo> = Vec::new();
  for path in world_dirs {
    let name = path.file_name().unwrap().to_str().unwrap();
    let icon_path = path.join("icon.png");
    let nbt_path = path.join("level.dat");
    if let Ok(level_data) = load_level_data_from_path(&nbt_path).await {
      let (last_played, difficulty, gamemode) = level_data_to_world_info(&level_data)?;
      world_list.push(WorldInfo {
        name: name.to_string(),
        last_played_at: last_played,
        difficulty: difficulty.to_string(),
        gamemode: gamemode.to_string(),
        icon_src: icon_path,
        dir_path: path,
      });
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
  let mut game_servers: Vec<GameServerInfo> = Vec::new();
  let game_root_dir =
    match get_instance_subdir_path_by_id(&app, &instance_id, &InstanceSubdirType::Root) {
      Some(path) => path,
      None => return Ok(Vec::new()),
    };

  let nbt_path = game_root_dir.join("servers.dat");
  let servers = match load_servers_info_from_path(&nbt_path).await {
    Ok(servers) => servers,
    Err(_) => return Err(InstanceError::ServerNbtReadError.into()),
  };
  for server in servers {
    game_servers.push(GameServerInfo {
      ip: server.ip,
      name: server.name,
      icon_src: server.icon.unwrap_or_default(),
      is_queried: false,
      players_max: 0,
      players_online: 0,
      online: false,
    });
  }

  // query_online is true, amend query and return player count and online status
  if query_online {
    let query_tasks = game_servers.clone().into_iter().map(|mut server| {
      tokio::spawn({
        async move {
          match query_server_status(&server.ip).await {
            Ok(query_result) => {
              server.is_queried = true;
              server.players_online = query_result.players.online as usize;
              server.players_max = query_result.players.max as usize;
              server.online = query_result.online;
              server.icon_src = query_result.favicon.unwrap_or_default();
            }
            Err(_) => {
              server.is_queried = false;
            }
          }
          server
        }
      })
    });
    let mut updated_servers = Vec::new();
    for (prev, query) in game_servers.into_iter().zip(query_tasks) {
      if let Ok(updated_server) = query.await {
        updated_servers.push(updated_server);
      } else {
        updated_servers.push(prev); // query error, use local data
      }
    }
    game_servers = updated_servers;
  }
  Ok(game_servers)
}

#[tauri::command]
pub async fn retrieve_local_mod_list(
  app: AppHandle,
  instance_id: String,
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
  for path in mod_paths {
    let task = tokio::spawn(async move { get_mod_info_from_jar(&path).await.ok() });
    tasks.push(task);
  }
  let mod_paths = get_subdirectories(&mods_dir).unwrap_or_default();
  for path in mod_paths {
    let task = tokio::spawn(async move { get_mod_info_from_dir(&path).await.ok() });
    tasks.push(task);
  }
  let mut mod_infos = Vec::new();
  for task in tasks {
    if let Ok(Some(mod_info)) = task.await {
      mod_infos.push(mod_info);
    }
  }

  // check potential incompatibility
  let binding = app.state::<Mutex<HashMap<String, Instance>>>();
  let state = binding.lock().unwrap();
  let instance = state
    .get(&instance_id)
    .ok_or(InstanceError::InstanceNotFoundByID)?;

  mod_infos.iter_mut().for_each(|mod_info| {
    mod_info.potential_incompatibility = instance.mod_loader.loader_type != ModLoaderType::Unknown
      && mod_info.loader_type != instance.mod_loader.loader_type;
  });

  // sort by name (and version)
  mod_infos.sort();

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
        icon_src: icon_src.map(ImageWrapper::from),
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
        icon_src: icon_src.map(ImageWrapper::from),
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
        icon_src: icon_src.map(ImageWrapper::from),
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
        icon_src: icon_src.map(ImageWrapper::from),
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
  if let Ok(level_data) = load_level_data_from_path(&level_path).await {
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
  version_info.patches.push(PatchesInfo {
    id: "game".to_string(),
    version: game.id.clone(),
    priority: 0,
    inherits_from: None,
    arguments: version_info.arguments.clone(),
    minecraft_arguments: version_info.minecraft_arguments.clone(),
    main_class: version_info.main_class.clone(),
    asset_index: version_info.asset_index.clone(),
    assets: version_info.assets.clone(),
    downloads: version_info.downloads.clone(),
    libraries: version_info.libraries.clone(),
    logging: version_info.logging.clone(),
    java_version: Some(version_info.java_version.clone()),
    type_: version_info.type_.clone(),
    time: version_info.time.clone(),
    release_time: version_info.release_time.clone(),
    minimum_launcher_version: version_info.minimum_launcher_version,
  });

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
    &[&InstanceSubdirType::Libraries, &InstanceSubdirType::Assets],
  )
  .ok_or(InstanceError::InstanceNotFoundByID)?;
  let [libraries_dir, assets_dir] = subdirs.as_slice() else {
    return Err(InstanceError::InstanceNotFoundByID.into());
  };

  replace_native_libraries(&app, &mut version_info, &instance)
    .await
    .map_err(|_| InstanceError::ClientJsonParseError)?;

  // We only download libraries if they are invalid (not already downloaded)
  task_params.extend(
    get_invalid_library_files(priority_list[0], libraries_dir, &version_info, false).await?,
  );

  // Download asset index
  let asset_index = client
    .get(version_info.asset_index.url.clone())
    .send()
    .await
    .map_err(|_| InstanceError::NetworkError)?
    .json::<AssetIndex>()
    .await
    .map_err(|_| InstanceError::AssetIndexParseError)?;

  let asset_index_path = assets_dir.join("indexes");

  // We only download assets if they are invalid (not already downloaded)
  task_params.extend(get_invalid_assets(priority_list[0], assets_dir, &asset_index, false).await?);

  if instance.mod_loader.loader_type != ModLoaderType::Unknown {
    install_mod_loader(
      app.clone(),
      &priority_list,
      &instance.version,
      &instance.mod_loader,
      libraries_dir.to_path_buf(),
      &mut version_info,
      &mut task_params,
    )
    .await?;
  }
  schedule_progressive_task_group(
    app.clone(),
    format!("game-client?{}", name),
    task_params,
    true,
  )
  .await?;

  fs::create_dir_all(&version_path).map_err(|_| InstanceError::FolderCreationFailed)?;
  instance
    .save_json_cfg()
    .await
    .map_err(|_| InstanceError::FileCreationFailed)?;
  let version_info_path = directory
    .dir
    .join(format!("versions/{}/{}.json", name, name));

  fs::write(
    &version_info_path,
    serde_json::to_vec_pretty(&version_info)?,
  )
  .map_err(|_| InstanceError::FileCreationFailed)?;
  fs::create_dir_all(&asset_index_path).map_err(|_| InstanceError::FolderCreationFailed)?;
  fs::write(
    asset_index_path.join(format!("{}.json", version_info.asset_index.id)),
    serde_json::to_vec_pretty(&asset_index)?,
  )
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
    ModLoaderStatus::NotDownloaded => {
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

  let client_info_dir = instance
    .version_path
    .join(format!("{}.json", instance.name));
  let client_info = load_json_async::<McClientInfo>(&client_info_dir).await?;

  let install_profile_dir = instance.version_path.join("install_profile.json");
  if install_profile_dir.exists() {
    let install_profile = load_json_async::<InstallProfile>(&install_profile_dir).await?;
    execute_processors(&app, &instance, &client_info, &install_profile).await?;
  }

  let instance = {
    let binding = app.state::<Mutex<HashMap<String, Instance>>>();
    let mut state = binding.lock()?;
    let instance = state
      .get_mut(&instance_id)
      .ok_or(InstanceError::InstanceNotFoundByID)?;
    instance.mod_loader.status = ModLoaderStatus::Installed;
    instance.clone()
  };
  instance.save_json_cfg().await?;

  Ok(())
}
