use super::super::models::misc::{Instance, InstanceSubdirType, ModLoader};
use super::client_json::McClientInfo;
use super::version_dir::rename_game_version_id;
use crate::launcher_config::models::GameConfig;
use crate::storage::{load_json_async, save_json_async};
use crate::{
  instance::helpers::client_json::patchs_to_info,
  launcher_config::models::{GameDirectory, LauncherConfig},
};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};

pub fn get_instance_client_json_path(app: &AppHandle, instance_id: usize) -> Option<PathBuf> {
  let binding = app.state::<Mutex<Vec<Instance>>>();
  let state = binding.lock().unwrap();
  let instance = state.get(instance_id)?;

  let version_path = &instance.version_path;
  let json_path = version_path.join(format!("{}.json", instance.name));
  Some(json_path)
}

pub fn get_game_config(app: &AppHandle, instance: &Instance) -> GameConfig {
  if instance.use_spec_game_config {
    if let Some(v) = &instance.spec_game_config {
      return v.clone();
    }
  }
  app
    .state::<Mutex<LauncherConfig>>()
    .lock()
    .unwrap()
    .global_game_config
    .clone()
}

// if instance_id not exists, return None
pub fn get_instance_subdir_path(
  app: &AppHandle,
  instance_id: usize,
  directory_type: &InstanceSubdirType,
) -> Option<PathBuf> {
  let binding = app.state::<Mutex<Vec<Instance>>>();
  let state = binding.lock().unwrap();
  let instance = state.get(instance_id)?;

  let version_path = &instance.version_path;
  let game_dir = version_path.parent().unwrap().parent().unwrap(); // TODO: remove unwrap

  let version_isolation = get_game_config(app, instance).version_isolation;

  let path = match directory_type {
    InstanceSubdirType::Assets | InstanceSubdirType::Libraries => game_dir, // no version isolation
    _ => {
      // others
      if version_isolation {
        version_path
      } else {
        game_dir
      }
    }
  };

  match directory_type {
    // enum to string
    InstanceSubdirType::Assets => Some(path.join("assets")),
    InstanceSubdirType::Libraries => Some(path.join("libraries")),
    InstanceSubdirType::Mods => Some(path.join("mods")),
    InstanceSubdirType::ResourcePacks => Some(path.join("resourcepacks")),
    InstanceSubdirType::Root => Some(path.to_path_buf()),
    InstanceSubdirType::Saves => Some(path.join("saves")),
    InstanceSubdirType::Schematics => Some(path.join("schematics")),
    InstanceSubdirType::Screenshots => Some(path.join("screenshots")),
    InstanceSubdirType::ServerResourcePacks => Some(path.join("server-resource-packs")),
    InstanceSubdirType::ShaderPacks => Some(path.join("shaderpacks")),
  }
}

const CFG_FILE_NAME: &str = "sjmclcfg.json";

pub async fn refresh_instances(
  game_directory: &GameDirectory,
) -> Result<Vec<Instance>, std::io::Error> {
  let mut instances = vec![];
  // traverse the "versions" directory
  let versions_dir = game_directory.dir.join("versions");
  for entry in fs::read_dir(versions_dir)? {
    let entry = match entry {
      Ok(v) => v,
      Err(_) => continue,
    };
    let mut version_path = entry.path();
    if !version_path.is_dir() {
      continue;
    }

    let name = entry.file_name().into_string().unwrap();
    // if there exists name.jar and name.json, then it's a valid instance
    let jar_path = version_path.join(format!("{}.jar", name));
    let json_path = version_path.join(format!("{}.json", name));
    if !jar_path.exists() || !json_path.exists() {
      continue; // not a valid instance
    }

    let client_data = match load_json_async::<McClientInfo>(&json_path).await {
      Ok(v) => v,
      Err(_) => continue,
    };
    if client_data.id != name {
      if let Ok(dst_dir) = rename_game_version_id(&version_path, &client_data.id) {
        version_path = dst_dir;
      } else {
        continue;
      }
    }
    let name = client_data.id.clone();
    let cfg_path = version_path.join(CFG_FILE_NAME);
    let mut cfg_read = load_json_async::<Instance>(&cfg_path)
      .await
      .unwrap_or_default();

    let (game_version, mod_version, loader_type) = patchs_to_info(&client_data.patches);
    if cfg_read.icon_src.is_empty() {
      cfg_read.icon_src = loader_type.to_icon_path().to_string();
    }

    let instance = Instance {
      name,
      version: game_version.unwrap_or_default(),
      version_path,
      mod_loader: ModLoader {
        loader_type,
        version: mod_version.unwrap_or_default(),
      },
      ..cfg_read
    };
    // ignore error here, for now
    save_json_async::<Instance>(&instance, &cfg_path).await.ok();
    instances.push(instance);
  }

  Ok(instances)
}

pub async fn refresh_all_instances(game_directories: &[GameDirectory]) -> Vec<Instance> {
  let mut instances = vec![];
  for game_directory in game_directories {
    match refresh_instances(game_directory).await {
      Ok(mut v) => instances.append(&mut v),
      Err(_) => continue,
    }
  }
  // assign id
  for (i, instance) in instances.iter_mut().enumerate() {
    instance.id = i;
  }
  instances
}

pub async fn refresh_and_update_instances(app: &AppHandle) {
  // get launcher config -> local game directories
  let local_game_directories = {
    let binding = app.state::<Mutex<LauncherConfig>>();
    let state = binding.lock().unwrap();
    state.local_game_directories.clone()
  };
  let instances = refresh_all_instances(&local_game_directories).await;
  // update the instances in the app state
  let binding = app.state::<Mutex<Vec<Instance>>>();
  let mut state = binding.lock().unwrap();
  *state = instances;
}
