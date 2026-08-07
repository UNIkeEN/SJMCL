use quartz_nbt::io::Flavor;
use quartz_nbt::serde::deserialize;
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use zip::ZipArchive;

use crate::instance::helpers::mods::common::compress_icon;
use crate::instance::models::world::base::WorldInfo;
use crate::instance::models::world::level::{Level, LevelData};
use crate::utils::image::{ImageWrapper, decode_image};

pub async fn load_world_info_from_dir(
  path: &Path,
  has_difficulty_support: bool,
) -> SJMCLResult<WorldInfo> {
  let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

  let icon_path = path.join("icon.png");
  let nbt_path = path.join("level.dat");

  let level_data = load_level_data_from_nbt(&nbt_path).await?;
  let (last_played, difficulty, gamemode) = level_data_to_world_info(&level_data)?;

  Ok(WorldInfo {
    name: name.to_string(),
    last_played_at: last_played,
    difficulty: has_difficulty_support.then(|| difficulty.to_string()),
    gamemode: gamemode.to_string(),
    icon_src: icon_path.to_string_lossy().into_owned(),
    dir_path: path.to_path_buf(),
    is_zip: false,
  })
}

pub fn load_world_info_from_zip(path: &Path, has_difficulty_support: bool) -> Option<WorldInfo> {
  let name = path.file_stem()?.to_string_lossy().into_owned();
  let file = File::open(path).ok()?;
  let mut zip = ZipArchive::new(file).ok()?;

  let mut level_bytes = None;
  let mut icon_bytes = None;
  for i in 0..zip.len() {
    let Ok(mut entry) = zip.by_index(i) else {
      continue;
    };
    let Some(entry_name) = entry.enclosed_name() else {
      continue;
    };
    match entry_name.file_name().and_then(|n| n.to_str()) {
      Some("level.dat") if level_bytes.is_none() => {
        let mut bytes = Vec::new();
        if entry.read_to_end(&mut bytes).is_ok() {
          level_bytes = Some(bytes);
        }
      }
      Some("icon.png") if icon_bytes.is_none() => {
        let mut bytes = Vec::new();
        if entry.read_to_end(&mut bytes).is_ok() {
          icon_bytes = Some(bytes);
        }
      }
      _ => {}
    }
    if level_bytes.is_some() && icon_bytes.is_some() {
      break;
    }
  }

  let level_bytes = level_bytes?;
  let (level, _) = deserialize::<Level>(&level_bytes, Flavor::GzCompressed).ok()?;
  let (last_played, difficulty, gamemode) = level_data_to_world_info(&level.data).ok()?;

  let icon_src = match icon_bytes {
    Some(bytes) => decode_image(bytes)
      .ok()
      .map(|img| {
        let wrapper = compress_icon(ImageWrapper::from(img));
        serde_json::to_string(&wrapper)
          .map(|s| s.trim_matches('"').to_string())
          .unwrap_or_default()
      })
      .unwrap_or_default(),
    None => String::new(),
  };

  Some(WorldInfo {
    name,
    last_played_at: last_played,
    difficulty: has_difficulty_support.then(|| difficulty.to_string()),
    gamemode: gamemode.to_string(),
    icon_src,
    dir_path: path.to_path_buf(),
    is_zip: true,
  })
}

pub async fn load_level_data_from_nbt(path: &PathBuf) -> SJMCLResult<LevelData> {
  let nbt_bytes = tokio::fs::read(path).await?;
  let (level, _) = deserialize::<Level>(&nbt_bytes, Flavor::GzCompressed)?;
  Ok(level.data)
}

pub fn load_world_data_from_zip(path: &Path) -> SJMCLResult<LevelData> {
  let file = File::open(path)?;
  let mut zip = ZipArchive::new(file).map_err(SJMCLError::from)?;
  for i in 0..zip.len() {
    let Ok(mut entry) = zip.by_index(i) else {
      continue;
    };
    let Some(entry_name) = entry.enclosed_name() else {
      continue;
    };
    if entry_name.file_name().and_then(|n| n.to_str()) == Some("level.dat") {
      let mut bytes = Vec::new();
      entry.read_to_end(&mut bytes)?;
      let (level, _) = deserialize::<Level>(&bytes, Flavor::GzCompressed)?;
      return Ok(level.data);
    }
  }
  Err(SJMCLError("level.dat not found in world zip".to_string()))
}

fn level_data_to_world_info(data: &LevelData) -> SJMCLResult<(i64, String, String)> {
  // return (last_played, difficulty, gamemode)
  let last_played = data.last_played / 1000;
  let mut difficulty: u8;
  if let Some(ref val) = data.difficulty {
    difficulty = *val;
  } else {
    difficulty = 2;
  }
  if data.hardcore {
    difficulty = 4;
  }
  const DIFFICULTY_STR: [&str; 5] = ["peaceful", "easy", "normal", "hard", "hardcore"];
  if difficulty >= DIFFICULTY_STR.len() as u8 {
    return Err(SJMCLError(format!(
      "difficulty = {}, which is greater than 5",
      difficulty
    )));
  }
  let gametype = data.game_type;
  const GAMEMODE_STR: [&str; 4] = ["survival", "creative", "adventure", "spectator"];
  if gametype < 0 || gametype >= GAMEMODE_STR.len() as i64 {
    return Err(SJMCLError(format!(
      "gametype = {}, which < 0 or >= 4",
      gametype
    )));
  }
  Ok((
    last_played,
    DIFFICULTY_STR[difficulty as usize].to_string(),
    GAMEMODE_STR[gametype as usize].to_string(),
  ))
}
