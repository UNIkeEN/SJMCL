use super::models::{Instance, InstanceSubdirType, ModLoader};
use crate::launcher_config::models::{GameDirectory, LauncherConfig};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};

// if instance_id not exists, return None
pub fn get_instance_subdir_path(
  app: &AppHandle,
  instance_id: usize,
  directory_type: &InstanceSubdirType,
) -> Option<PathBuf> {
  let binding = app.state::<Mutex<Vec<Instance>>>();
  let state = binding.lock().unwrap();
  let instance = match state.get(instance_id) {
    Some(v) => v,
    None => return None,
  };

  let version_path = &instance.version_path;
  let game_dir = version_path.parent().unwrap().parent().unwrap(); // TODO: remove unwrap

  // TODO: function to extract config
  let version_isolation = match &instance.game_config {
    Some(v) => v.version_isolation,
    None => {
      app
        .state::<Mutex<LauncherConfig>>()
        .lock()
        .unwrap()
        .global_game_config
        .version_isolation
    }
  };

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
    InstanceSubdirType::Saves => Some(path.join("saves")),
    InstanceSubdirType::Schematics => Some(path.join("schematics")),
    InstanceSubdirType::Screenshots => Some(path.join("screenshots")),
    InstanceSubdirType::ShaderPacks => Some(path.join("shaderpacks")),
    InstanceSubdirType::GameRoot => Some(path.to_path_buf()),
  }
}

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
    let version_path = entry.path();
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

    // TODO: read the config file if exists, else create one
    // TODO: determine the version isolation strategy

    instances.push(Instance {
      id: 0, // not decided yet
      name,
      description: "mock desc".to_string(), // TODO: fix these mock fields
      icon_src: "/images/icons/GrassBlock.png".to_string(),
      version: "1.20.1".to_string(), // TODO: may read from name.json["patches"]["version"]?
      version_path,
      mod_loader: ModLoader {
        loader_type: "none".to_string(),
        version: "".to_string(),
      },
      has_schem_folder: true, // TODO: if exists schematics folder, return true
      game_config: None,
    });
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
