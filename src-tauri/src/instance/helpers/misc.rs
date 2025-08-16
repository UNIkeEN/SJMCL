use super::client_json::McClientInfo;
use super::{
  super::models::misc::{Instance, InstanceError, InstanceSubdirType, ModLoader},
  client_jar::load_game_version_from_jar,
};
use crate::error::SJMCLResult;
use crate::instance::helpers::loader::{
  forge::download_forge_libraries, neoforge::download_neoforge_libraries,
};
use crate::instance::models::misc::{ModLoaderStatus, ModLoaderType};
use crate::launcher_config::{helpers::misc::get_global_game_config, models::GameConfig};
use crate::resource::helpers::misc::get_source_priority_list;
use crate::storage::load_json_async;
use crate::{
  instance::helpers::client_json::patches_to_info,
  launcher_config::models::{GameDirectory, LauncherConfig},
};
use sanitize_filename;
use serde_json::Value;
use std::{collections::HashMap, fs, io::Cursor, path::PathBuf, sync::Mutex};
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
      let path_buf = match directory_type {
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
      };

      // Create directory if it doesn't exist
      if !path_buf.exists() {
        let _ = fs::create_dir_all(&path_buf);
      }

      path_buf
    })
    .collect();

  Some(paths) // if instance_id not exists, return None
}

pub fn get_instance_subdir_path_by_id(
  app: &AppHandle,
  instance_id: &String,
  directory_type: &InstanceSubdirType,
) -> Option<PathBuf> {
  let binding = app.state::<Mutex<HashMap<String, Instance>>>();
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
  app: &AppHandle,
  game_directory: &GameDirectory,
  is_first_run: bool,
) -> SJMCLResult<Vec<Instance>> {
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
      Err(e) => {
        println!("Failed to load client info for {}: {}", name, e);
        continue;
      }
    };
    if client_data.id != name {
      if let Ok(dst_dir) = unify_instance_name(&version_path, &client_data.id) {
        version_path = dst_dir;
      } else {
        println!("Failed to unify instance name for {}", name);
        continue;
      }
    }
    let name = client_data.id.clone();
    let mut cfg_read = Instance {
      version_path: version_path.clone(),
      ..Default::default()
    }
    .load_json_cfg()
    .await
    .unwrap_or_default();

    if cfg_read.mod_loader.status != ModLoaderStatus::Installed {
      let priority_list = {
        let launcher_config_state = app.state::<Mutex<LauncherConfig>>();
        let launcher_config = launcher_config_state.lock()?;
        get_source_priority_list(&launcher_config)
      };
      if let Err(e) = {
        match cfg_read.mod_loader.status {
          ModLoaderStatus::NotDownloaded => match cfg_read.mod_loader.loader_type {
            ModLoaderType::Forge => {
              cfg_read.mod_loader.status = ModLoaderStatus::Downloading;
              download_forge_libraries(app, &priority_list, &cfg_read, &client_data).await
            }
            ModLoaderType::NeoForge => {
              cfg_read.mod_loader.status = ModLoaderStatus::Downloading;
              download_neoforge_libraries(app, &priority_list, &cfg_read, &client_data).await
            }
            _ => Ok(()),
          },
          ModLoaderStatus::Downloading | ModLoaderStatus::Installing => {
            if is_first_run {
              // if it's the first run, reset the status and wait for download
              cfg_read.mod_loader.status = ModLoaderStatus::NotDownloaded;
            }
            Ok(())
          }
          ModLoaderStatus::Installed => Ok(()),
        }
      } {
        eprintln!("Failed to install mod loader for {}: {:?}", name, e);
        cfg_read.mod_loader.status = ModLoaderStatus::NotDownloaded;
        cfg_read.save_json_cfg().await?;
        continue;
      }
    }

    let (mut game_version, loader_version, loader_type) = patches_to_info(&client_data.patches);
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
      mod_loader: if cfg_read.mod_loader.status != ModLoaderStatus::Installed {
        // pass mod loader check if download is not ready
        cfg_read.mod_loader
      } else {
        ModLoader {
          loader_type,
          version: loader_version.unwrap_or_default(),
          status: ModLoaderStatus::Installed,
          branch: None,
        }
      },
      ..cfg_read
    };
    // ignore error here, for now
    instance.save_json_cfg().await?;
    instances.push(instance);
  }

  Ok(instances)
}

pub async fn refresh_all_instances(
  app: &AppHandle,
  game_directories: &[GameDirectory],
  is_first_run: bool,
) -> HashMap<String, Instance> {
  let mut instance_map = HashMap::new();

  for game_directory in game_directories {
    let dir_name = game_directory.name.clone();
    match refresh_instances(app, game_directory, is_first_run).await {
      Ok(vs) => {
        for mut instance in vs {
          let composed_id = format!("{}:{}", dir_name, instance.name);
          instance.id = composed_id.clone();
          instance_map.insert(composed_id, instance);
        }
      }
      Err(_) => continue,
    }
  }

  instance_map
}

pub async fn refresh_and_update_instances(app: &AppHandle, is_first_run: bool) {
  // get launcher config -> local game directories
  let local_game_directories = {
    let binding = app.state::<Mutex<LauncherConfig>>();
    let state = binding.lock().unwrap();
    state.local_game_directories.clone()
  };
  let instances = refresh_all_instances(app, &local_game_directories, is_first_run).await;
  // update the instances in the app state
  let binding = app.state::<Mutex<HashMap<String, Instance>>>();
  let mut state = binding.lock().unwrap();
  *state = instances;
}
