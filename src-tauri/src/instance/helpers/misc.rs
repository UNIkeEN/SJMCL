use super::client_json::McClientInfo;
use super::{
  super::{
    constants::INSTANCE_CFG_FILE_NAME,
    models::misc::{Instance, InstanceError, InstanceSubdirType, ModLoader},
  },
  client_jar::load_game_version_from_jar,
};
use crate::error::SJMCLResult;
use crate::launcher_config::{helpers::get_global_game_config, models::GameConfig};
use crate::storage::{load_json_async, save_json_async};
use crate::{
  instance::helpers::client_json::patchs_to_info,
  launcher_config::models::{GameDirectory, LauncherConfig},
};
use sanitize_filename;
use serde_json::Value;
use std::{fs, io::Cursor, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

pub fn get_instance_game_config(app: &AppHandle, instance: &Instance) -> GameConfig {
  if instance.use_spec_game_config {
    if let Some(v) = &instance.spec_game_config {
      return v.clone();
    }
  }
  get_global_game_config(app)
}

pub fn get_instance_subdir_paths(
  app: &AppHandle,
  instance: &Instance,
  directory_types: &[&InstanceSubdirType],
) -> Option<Vec<PathBuf>> {
  let version_path = &instance.version_path;
  let game_dir = version_path.parent()?.parent()?; // safe unwrap to `?`

  let version_isolation = get_instance_game_config(app, instance).version_isolation;
  let path = if version_isolation {
    version_path
  } else {
    game_dir
  };

  let paths = directory_types
    .iter()
    .map(|directory_type| {
      match directory_type {
        InstanceSubdirType::Assets => game_dir.join("assets"),
        InstanceSubdirType::Libraries => game_dir.join("libraries"),
        InstanceSubdirType::Mods => path.join("mods"),
        InstanceSubdirType::ResourcePacks => path.join("resourcepacks"),
        InstanceSubdirType::Root => path.to_path_buf(),
        InstanceSubdirType::Saves => path.join("saves"),
        InstanceSubdirType::Schematics => path.join("schematics"),
        InstanceSubdirType::Screenshots => path.join("screenshots"),
        InstanceSubdirType::ServerResourcePacks => path.join("server-resource-packs"),
        InstanceSubdirType::ShaderPacks => path.join("shaderpacks"),
        // native libraries extracted by SJMCL
        InstanceSubdirType::NativeLibraries => version_path.join(format!(
          "natives-{}-{}",
          tauri_plugin_os::platform(),
          tauri_plugin_os::arch()
        )),
      }
    })
    .collect();

  Some(paths) // if instance_id not exists, return None
}

pub fn get_instance_subdir_path_by_id(
  app: &AppHandle,
  instance_id: usize,
  directory_type: &InstanceSubdirType,
) -> Option<PathBuf> {
  let binding = app.state::<Mutex<Vec<Instance>>>();
  let state = binding.lock().unwrap();
  let instance = state.get(instance_id)?;

  get_instance_subdir_paths(app, instance, &[directory_type]).and_then(|mut paths| paths.pop())
}

pub fn unify_instance_name(src_version_path: &PathBuf, tgt_name: &String) -> SJMCLResult<PathBuf> {
  if !sanitize_filename::is_sanitized(tgt_name) {
    return Err(InstanceError::InvalidNameError.into());
  }
  let src_name = src_version_path
    .file_name()
    .ok_or(InstanceError::InvalidSourcePath)?
    .to_string_lossy()
    .to_string();
  let version_root = src_version_path.parent().unwrap();
  // rename version directory (if already exists, return conflict error)
  let dst_dir = version_root.join(tgt_name);
  if dst_dir.exists() {
    let mut entries = fs::read_dir(&dst_dir)?;
    if entries.next().is_some() {
      return Err(InstanceError::ConflictNameError.into());
    }
  }
  fs::rename(src_version_path, &dst_dir).map_err(|_| InstanceError::FileMoveFailed)?;

  // rename client jar
  let old_jar = dst_dir.join(format!("{}.jar", src_name));
  let new_jar = dst_dir.join(format!("{}.jar", tgt_name));
  fs::rename(old_jar, new_jar).map_err(|_| InstanceError::FileMoveFailed)?;

  // rewrite client json, update "id" field and filename
  let old_json = dst_dir.join(format!("{}.json", src_name));
  let new_json = dst_dir.join(format!("{}.json", tgt_name));
  let mut json_value: Value = serde_json::from_reader(fs::File::open(&old_json)?)?;
  if let Some(obj) = json_value.as_object_mut() {
    obj.insert("id".to_string(), Value::String(tgt_name.clone()));
  }
  fs::write(&new_json, json_value.to_string())?;
  fs::remove_file(old_json)?;

  Ok(dst_dir)
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
      if let Ok(dst_dir) = unify_instance_name(&version_path, &client_data.id) {
        version_path = dst_dir;
      } else {
        continue;
      }
    }
    let name = client_data.id.clone();
    let cfg_path = version_path.join(INSTANCE_CFG_FILE_NAME);
    let mut cfg_read = load_json_async::<Instance>(&cfg_path)
      .await
      .unwrap_or_default();

    let (mut game_version, mod_version, loader_type) = patchs_to_info(&client_data.patches);
    // TODO: patches related logic
    if game_version.is_none() {
      let file = Cursor::new(tokio::fs::read(jar_path).await?);
      if let Ok(mut jar) = ZipArchive::new(file) {
        game_version = load_game_version_from_jar(&mut jar);
      }
    }

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
