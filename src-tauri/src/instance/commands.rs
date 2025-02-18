use super::{
  super::utils::image::image_to_base64,
  helpers::{get_instance_subdir_path, refresh_and_update_instances},
  models::{
    GameServerInfo, Instance, InstanceError, InstanceSubdirType, ResourcePackInfo, SchematicInfo,
    ScreenshotInfo, ShaderPackInfo,
  },
};
use crate::error::SJMCLResult;
use image::ImageReader;
use serde_json::Value;
use std::{
  fs,
  io::{Cursor, Read},
  path::{Path, PathBuf},
  sync::Mutex,
  time::SystemTime,
};
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use tauri_plugin_shell::ShellExt;
use zip::read::ZipArchive;

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
    None => return Err(InstanceError::SubdirTypeNotFound.into()),
  };

  match app.shell().open(subdir_path.to_str().unwrap(), None) {
    Ok(_) => Ok(()),
    Err(_) => Err(InstanceError::ExecOpenDirError.into()),
  }
}

#[tauri::command]
pub async fn retrive_game_server_list(
  instance_id: usize,
  query_online: bool,
) -> SJMCLResult<Vec<GameServerInfo>> {
  // query_online is false, return local data from nbt (servers.dat)
  // TODO: now use mock data
  let mut game_servers = vec![
    GameServerInfo {
        icon_src: "https://mc.sjtu.cn/wiki/images/8/8c/SMP2-server-icon.png".to_string(),
        ip: "smp2.sjmc.club".to_string(),
        name: "SJMC-SMP2.6".to_string(),
        is_queried: false,
        players_online: 0,
        players_max: 0,
        online: false,
    },
    GameServerInfo {
        icon_src: "https://zh.minecraft.wiki/images/thumb/Minecraft_Preview_icon_2.png/240px-Minecraft_Preview_icon_2.png".to_string(),
        ip: "smp3.sjmc.club".to_string(),
        name: "SJMC-SMP3(offline display test)".to_string(),
        is_queried: false,
        players_online: 0,
        players_max: 0,
        online: false,
    },
  ];

  // query_online is true, amend query and return player count and online status
  if query_online {
    for server in &mut game_servers {
      let url = format!("https://mc.sjtu.cn/custom/serverlist/?query={}", server.ip);
      server.is_queried = false;
      let response = match reqwest::get(&url).await {
        Ok(response) => response,
        Err(_) => continue, // request error
      };
      if !response.status().is_success() {
        continue; // request error
      }
      let data = match response.json::<Value>().await {
        Ok(data) => data,
        Err(_) => continue, // JSON parse error
      };
      // manually parse the JSON into the required fields
      if let Some(players) = data["players"].as_object() {
        server.players_online = players["online"].as_u64().unwrap_or(0) as usize;
        server.players_max = players["max"].as_u64().unwrap_or(0) as usize;
      }
      server.online = data["online"].as_bool().unwrap_or(false);
      server.icon_src = data["favicon"].as_str().unwrap_or("").to_string();
      server.is_queried = true;
    }
  }

  Ok(game_servers)
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

  if !resource_packs_dir.exists() {
    return Ok(Vec::new());
  }
  let valid_extension = "zip";
  let resource_pack_list: Vec<PathBuf> = fs::read_dir(resource_packs_dir)?
    .filter_map(|entry| entry.ok())
    .filter_map(|entry| {
      let file_name = entry.file_name().into_string().ok()?;
      let extension = Path::new(&file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase());

      if extension.is_some() && extension.unwrap() == valid_extension {
        Some(entry.path())
      } else {
        None
      }
    })
    .collect();
  let mut info_list: Vec<ResourcePackInfo> = Vec::new();

  // TODO: async read files
  for path in resource_pack_list {
    let name = if let Some(file_stem_osstr) = path.file_stem() {
      if let Some(file_stem) = file_stem_osstr.to_str() {
        file_stem.to_owned() // Convert &str to String
      } else {
        String::new() // Handle case where filename is not valid UTF-8
      }
    } else {
      String::new() // Handle case where there is no file stem
    };

    let file = fs::File::open(&path)?;
    let mut zip = ZipArchive::new(file)?;
    let mut description = String::new();
    let mut icon_src = None;

    if let Ok(mut file) = zip.by_name("pack.mcmeta") {
      let mut contents = String::new();
      if let Err(err) = file.read_to_string(&mut contents) {
        #[cfg(debug_assertions)]
        println!("read to string error: {}", err.to_string());
      } else {
        // Check for and remove the UTF-8 BOM if present
        if contents.starts_with('\u{FEFF}') {
          contents = contents.strip_prefix('\u{FEFF}').unwrap().to_string();
        }
        let json_result = serde_json::from_str::<Value>(&contents);
        if json_result.is_ok() {
          // Safely extract `description`
          if let Some(pack_data) = json_result.ok().unwrap().get("pack") {
            if let Some(desc) = pack_data.get("description") {
              // Assume `desc` is a valid JSON object or primitive
              if let Some(desc_str) = desc.as_str() {
                description = desc_str.to_string(); // Assigns the description to your variable
              } else {
                #[cfg(debug_assertions)]
                println!("Description is not a string");
              }
            }
          }
        } else {
          #[cfg(debug_assertions)]
          println!(
            "json parse error: {}",
            json_result.err().unwrap().to_string()
          );
        }
      }
    }

    if let Ok(mut file) = zip.by_name("pack.png") {
      let mut buffer = Vec::new();
      file.read_to_end(&mut buffer)?;
      // Use `image` crate to decode the image
      let img = ImageReader::new(Cursor::new(buffer))
        .with_guessed_format()?
        .decode()?;
      if let Ok(b64) = image_to_base64(img.to_rgba8()) {
        icon_src = Some(b64);
      }
    }
    info_list.push(ResourcePackInfo {
      name,
      description,
      icon_src,
      file_path: path.to_string_lossy().to_string(),
    });
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

  let valid_extensions = ["litematic", "schematic"];

  let schematic_list: Vec<SchematicInfo> = fs::read_dir(schematics_dir)?
    .filter_map(|entry| entry.ok())
    .filter_map(|entry| {
      let file_name = entry.file_name().into_string().ok()?;
      let extension = Path::new(&file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase());

      if extension.is_some() && valid_extensions.contains(&extension.unwrap().as_str()) {
        let file_path = entry.path().to_string_lossy().to_string();

        Some(SchematicInfo {
          name: file_name,
          file_path,
        })
      } else {
        None
      }
    })
    .collect();

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

  let valid_extension = "zip";

  let shaderpack_list: Vec<ShaderPackInfo> = fs::read_dir(shaderpacks_dir)?
    .filter_map(|entry| entry.ok())
    .filter_map(|entry| {
      let file_name = entry.file_name().into_string().ok()?;
      let extension = Path::new(&file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase());

      if extension.is_some() && extension.unwrap() == valid_extension {
        let file_path = entry.path().to_string_lossy().to_string();

        Some(ShaderPackInfo {
          file_name,
          file_path,
        })
      } else {
        None
      }
    })
    .collect();

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
  let valid_extensions = ["jpg", "jpeg", "png"];

  let screenshot_list: Vec<ScreenshotInfo> = fs::read_dir(screenshots_dir)?
    .filter_map(|entry| entry.ok())
    .filter_map(|entry| {
      let file_name = entry.file_name().into_string().ok()?;
      let extension = Path::new(&file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase());

      if extension.is_some() && valid_extensions.contains(&extension.unwrap().as_str()) {
        let file_path = entry.path().to_string_lossy().to_string();

        let metadata = entry.metadata().ok()?;
        let modified_time = metadata.modified().ok()?;
        let timestamp = modified_time
          .duration_since(SystemTime::UNIX_EPOCH)
          .ok()?
          .as_secs();

        Some(ScreenshotInfo {
          file_name,
          file_path,
          time: timestamp,
        })
      } else {
        None
      }
    })
    .collect();

  Ok(screenshot_list)
}
