use super::{
  super::utils::{
    nbt::load_nbt,
    path::{get_files_with_regex, get_subdirectories},
  },
  helpers::{
    misc::{fetch_url, get_instance_subdir_path, refresh_and_update_instances},
    mods::main_loader::load_mod_from_file,
    resourcepack::{load_resourcepack_from_dir, load_resourcepack_from_zip},
    server::nbt_to_servers_info,
    world::nbt_to_world_info,
  },
  models::{
    GameServerInfo, Instance, InstanceError, InstanceSubdirType, LocalModInfo, ResourcePackInfo,
    SchematicInfo, ScreenshotInfo, ShaderPackInfo, WorldInfo,
  },
};
use crate::error::SJMCLResult;
use futures;
use quartz_nbt::io::Flavor;
use regex::RegexBuilder;
use std::{sync::Mutex, time::SystemTime};
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use tokio;

#[tauri::command]
pub async fn retrive_instance_list(app: AppHandle) -> SJMCLResult<Vec<Instance>> {
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

  match app.shell().open(subdir_path.to_str().unwrap(), None) {
    Ok(_) => Ok(()),
    Err(_) => Err(InstanceError::ExecOpenDirError.into()),
  }
}

#[tauri::command]
pub async fn retrive_world_list(app: AppHandle, instance_id: usize) -> SJMCLResult<Vec<WorldInfo>> {
  let worlds_dir = match get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::Saves) {
    Some(path) => path,
    None => return Ok(Vec::new()),
  };

  let world_dirs = match get_subdirectories(worlds_dir) {
    Ok(val) => val,
    Err(_) => return Ok(Vec::new()), // if dir not exists, no need to error
  };

  let mut world_list: Vec<WorldInfo> = Vec::new();
  // TODO: async read
  for path in world_dirs {
    let name = path.file_name().unwrap().to_str().unwrap();
    let icon_path = path.join("icon.png");
    let nbt_path = path.join("level.dat");
    if let Ok(nbt) = load_nbt(&nbt_path, Flavor::GzCompressed) {
      if let Ok((last_played, difficulty, gamemode)) = nbt_to_world_info(&nbt) {
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
  }
  Ok(world_list)
}

#[tauri::command]
pub async fn retrive_game_server_list(
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
  if let Ok(nbt) = load_nbt(&nbt_path, Flavor::Uncompressed) {
    if let Ok(servers) = nbt_to_servers_info(&nbt) {
      for (ip, name, icon) in servers {
        game_servers.push(GameServerInfo {
          ip,
          name,
          icon_src: icon,
          is_queried: false,
          players_max: 0,
          players_online: 0,
          online: false,
        });
      }
    } else {
      return Err(InstanceError::ServerNbtReadError.into());
    }

    // query_online is true, amend query and return player count and online status
    if query_online {
      let mut tasks = Vec::new();
      for server in game_servers {
        let url = format!("https://mc.sjtu.cn/custom/serverlist/?query={}", server.ip);
        tasks.push(tokio::spawn(async move { (server, fetch_url(&url).await) }));
      }
      let results = futures::future::join_all(tasks).await;
      game_servers = Vec::new();
      for result in results {
        if let Ok((mut server, data)) = result {
          if let Some(data) = data {
            if let Some(players) = data["players"].as_object() {
              server.players_online = players["online"].as_u64().unwrap_or(0) as usize;
              server.players_max = players["max"].as_u64().unwrap_or(0) as usize;
            }
            server.online = data["online"].as_bool().unwrap_or(false);
            server.icon_src = data["favicon"].as_str().unwrap_or("").to_string();
            server.is_queried = true;
          }
          game_servers.push(server);
        }
      }
    }
  } // don't report error when missing nbt file
  Ok(game_servers)
}

#[tauri::command]
pub async fn retrive_local_mod_list(
  app: AppHandle,
  instance_id: usize,
) -> SJMCLResult<Vec<LocalModInfo>> {
  let mut local_mods: Vec<LocalModInfo> = Vec::new();
  let mods_dir = match get_instance_subdir_path(&app, instance_id, &InstanceSubdirType::Mods) {
    Some(path) => path,
    None => return Ok(Vec::new()),
  };
  let valid_extensions = RegexBuilder::new(r"\.jar(\.disabled)?$")
    .case_insensitive(true)
    .build()
    .unwrap();

  for path in get_files_with_regex(&mods_dir, &valid_extensions).unwrap_or_default() {
    if let Ok(mod_info) = load_mod_from_file(&path) {
      local_mods.push(mod_info);
    }
  }
  local_mods.sort();

  Ok(local_mods)
}

#[tauri::command]
pub async fn retrive_resource_pack_list(
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
pub async fn retrive_server_resource_pack_list(
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
pub fn retrive_schematic_list(
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
pub fn retrive_shader_pack_list(
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
  // TODO: async read files
  for path in get_files_with_regex(shaderpacks_dir, &valid_extensions)? {
    shaderpack_list.push(ShaderPackInfo {
      file_name: path.file_stem().unwrap().to_string_lossy().to_string(),
      file_path: path,
    });
  }

  Ok(shaderpack_list)
}

#[tauri::command]
pub fn retrive_screenshot_list(
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
