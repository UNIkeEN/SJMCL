use super::{
  super::utils::{
    fs::{copy_whole_dir, generate_unique_filename},
    path::{get_files_with_regex, get_subdirectories},
  },
  helpers::{
    misc::{get_instance_subdir_path, refresh_and_update_instances},
    mods::common::{get_mod_info_from_dir, get_mod_info_from_jar},
    resourcepack::{load_resourcepack_from_dir, load_resourcepack_from_zip},
    server::{load_servers_info_from_path, query_server_status},
    world::{level_data_to_world_info, load_level_data_from_path},
  },
  models::{
    misc::{
      GameServerInfo, Instance, InstanceError, InstanceSubdirType, LocalModInfo, ModLoaderType,
      ResourcePackInfo, SchematicInfo, ScreenshotInfo, ShaderPackInfo,
    },
    world::{base::WorldInfo, level::LevelData},
  },
};
use crate::error::SJMCLResult;
use lazy_static::lazy_static;
use regex::{Regex, RegexBuilder};
use std::fs;
use std::path::{Path, PathBuf};
use std::{sync::Mutex, time::SystemTime};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::open_path;
use tokio;

#[tauri::command]
pub async fn retrieve_instance_list(app: AppHandle) -> SJMCLResult<Vec<Instance>> {
  refresh_and_update_instances(&app).await; // firstly refresh and update
  let binding = app.state::<Mutex<Vec<Instance>>>();
  let state = binding.lock()?;
  Ok(state.clone())
}

#[tauri::command]
pub fn open_instance_subdir(
  app: AppHandle,
  instance_id: usize,
  dir_type: InstanceSubdirType,
) -> SJMCLResult<()> {
  let subdir_path = match get_instance_subdir_path(&app, instance_id, &dir_type) {
    Some(path) => path,
    None => return Err(InstanceError::InstanceNotFoundByID.into()),
  };

  match open_path(subdir_path.to_str().unwrap(), None::<&str>) {
    Ok(_) => Ok(()),
    Err(_) => Err(InstanceError::ExecOpenDirError.into()),
  }
}

#[tauri::command]
pub fn delete_instance(app: AppHandle, instance_id: usize) -> SJMCLResult<()> {
  let binding = app.state::<Mutex<Vec<Instance>>>();
  let state = binding.lock().unwrap();
  let instance = state
    .get(instance_id)
    .ok_or(InstanceError::InstanceNotFoundByID)?;

  let version_path = &instance.version_path;
  let path = Path::new(version_path);

  if path.exists() {
    fs::remove_dir_all(path)?;
  }
  // not update state here. if send success to frontend, it will call retrieve_instance_list and update state there.

  // TODO: update selected instance if necessary.
  Ok(())
}

#[tauri::command]
pub fn copy_across_instances(
  app: AppHandle,
  src_file_path: String,
  tgt_inst_ids: Vec<usize>,
  tgt_dir_type: InstanceSubdirType,
) -> SJMCLResult<()> {
  let src_path = Path::new(&src_file_path);

  if src_path.is_file() {
    let filename = match src_path.file_name() {
      Some(name) => name.to_os_string(),
      None => return Err(InstanceError::InvalidSourcePath.into()),
    };

    for tgt_inst_id in tgt_inst_ids {
      let tgt_path = match get_instance_subdir_path(&app, tgt_inst_id, &tgt_dir_type) {
        Some(path) => path,
        None => return Err(InstanceError::InstanceNotFoundByID.into()),
      };

      if !tgt_path.exists() {
        fs::create_dir_all(&tgt_path).map_err(|_| InstanceError::FolderCreationFailed)?;
      }

      let dest_path = generate_unique_filename(&tgt_path, &filename);
      fs::copy(&src_file_path, &dest_path).map_err(|_| InstanceError::FileCopyFailed)?;
    }
  } else if src_path.is_dir() {
    for tgt_inst_id in tgt_inst_ids {
      let tgt_path = match get_instance_subdir_path(&app, tgt_inst_id, &tgt_dir_type) {
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
pub fn move_across_instances(
  app: AppHandle,
  src_file_path: String,
  tgt_inst_id: usize,
  tgt_dir_type: InstanceSubdirType,
) -> SJMCLResult<()> {
  let tgt_path = match get_instance_subdir_path(&app, tgt_inst_id, &tgt_dir_type) {
    Some(path) => path,
    None => return Err(InstanceError::InstanceNotFoundByID.into()),
  };

  let src_path = Path::new(&src_file_path);

  if !src_path.is_dir() && !src_path.is_file() {
    return Err(InstanceError::InvalidSourcePath.into());
  }

  let filename = match src_path.file_name() {
    Some(name) => name.to_os_string(),
    None => return Err(InstanceError::InvalidSourcePath.into()),
  };

  if !tgt_path.exists() {
    fs::create_dir_all(&tgt_path).map_err(|_| InstanceError::FolderCreationFailed)?;
  }

  let dest_path = generate_unique_filename(&tgt_path, &filename);
  fs::rename(&src_file_path, &dest_path).map_err(|_| InstanceError::FileMoveFailed)?;
  Ok(())
}

#[tauri::command]
pub async fn retrieve_world_list(
  app: AppHandle,
  instance_id: usize,
) -> SJMCLResult<Vec<WorldInfo>> {
  let worlds_dir = match get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::Saves) {
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
  instance_id: usize,
  query_online: bool,
) -> SJMCLResult<Vec<GameServerInfo>> {
  // query_online is false, return local data from nbt (servers.dat)
  let mut game_servers: Vec<GameServerInfo> = Vec::new();
  let game_root_dir = match get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::Root) {
    Some(path) => path,
    None => return Ok(Vec::new()),
  };

  let nbt_path = game_root_dir.join("servers.dat");
  if let Ok(servers) = load_servers_info_from_path(&nbt_path).await {
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
        tokio::spawn(async move {
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
  } // don't report error when missing nbt file
  Ok(game_servers)
}

#[tauri::command]
pub async fn retrieve_local_mod_list(
  app: AppHandle,
  instance_id: usize,
) -> SJMCLResult<Vec<LocalModInfo>> {
  let mods_dir = match get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::Mods) {
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
  let binding = app.state::<Mutex<Vec<Instance>>>();
  let state = binding.lock().unwrap();
  let instance = state
    .get(instance_id)
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
  instance_id: usize,
) -> SJMCLResult<Vec<ResourcePackInfo>> {
  // Get the resource packs list based on the instance
  let resource_packs_dir =
    match get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::ResourcePacks) {
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
        icon_src,
        file_path: path.clone(),
      });
    }
  }

  for path in get_subdirectories(&resource_packs_dir).unwrap_or(vec![]) {
    if let Ok((description, icon_src)) = load_resourcepack_from_dir(&path) {
      let name = match path.file_stem() {
        Some(stem) => stem.to_string_lossy().to_string(),
        None => String::new(),
      };
      info_list.push(ResourcePackInfo {
        name,
        description,
        icon_src,
        file_path: path.clone(),
      });
    }
  }
  Ok(info_list)
}

#[tauri::command]
pub async fn retrieve_server_resource_pack_list(
  app: AppHandle,
  instance_id: usize,
) -> SJMCLResult<Vec<ResourcePackInfo>> {
  let resource_packs_dir =
    match get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::ServerResourcePacks) {
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
        icon_src,
        file_path: path.clone(),
      });
    }
  }

  for path in get_subdirectories(&resource_packs_dir).unwrap_or(vec![]) {
    if let Ok((description, icon_src)) = load_resourcepack_from_dir(&path) {
      let name = match path.file_stem() {
        Some(stem) => stem.to_string_lossy().to_string(),
        None => String::new(),
      };

      info_list.push(ResourcePackInfo {
        name,
        description,
        icon_src,
        file_path: path.clone(),
      });
    }
  }
  Ok(info_list)
}

#[tauri::command]
pub fn retrieve_schematic_list(
  app: AppHandle,
  instance_id: usize,
) -> SJMCLResult<Vec<SchematicInfo>> {
  let schematics_dir =
    match get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::Schematics) {
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
  instance_id: usize,
) -> SJMCLResult<Vec<ShaderPackInfo>> {
  // Get the shaderpacks directory based on the instance
  let shaderpacks_dir =
    match get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::ShaderPacks) {
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
  instance_id: usize,
) -> SJMCLResult<Vec<ScreenshotInfo>> {
  let screenshots_dir =
    match get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::Screenshots) {
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
  instance_id: usize,
  world_name: String,
) -> SJMCLResult<LevelData> {
  let worlds_dir = match get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::Saves) {
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
