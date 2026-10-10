use quartz_nbt::io::{Flavor, read_nbt};
use quartz_nbt::{NbtCompound, NbtTag};
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::io::ErrorKind;
use std::path::Path;
use uuid::Uuid;

use crate::instance::models::misc::InstanceError;
use crate::instance::models::world::{WorldDetails, WorldInfo};
use crate::utils::nbt::nbt_to_display_value;

pub async fn load_world_info_from_dir(
  path: &Path,
  has_difficulty_support: bool,
) -> SJMCLResult<WorldInfo> {
  // Both formats keep the world-list metadata in level.dat.
  let level = load_level_nbt(&path.join("level.dat")).await?;
  let (last_played, difficulty, gamemode) =
    level_data_to_world_info(level.get::<_, &NbtCompound>("Data")?)?;

  Ok(WorldInfo {
    name: path
      .file_name()
      .and_then(|n| n.to_str())
      .unwrap_or("")
      .to_string(),
    last_played_at: last_played,
    difficulty: has_difficulty_support.then_some(difficulty),
    gamemode,
    icon_src: path.join("icon.png"),
    dir_path: path.to_path_buf(),
  })
}

async fn read_nbt_file(path: &Path) -> SJMCLResult<Option<NbtCompound>> {
  let bytes = match tokio::fs::read(path).await {
    Ok(bytes) => bytes,
    Err(err) if err.kind() == ErrorKind::NotFound => return Ok(None),
    Err(err) => return Err(err.into()),
  };
  Ok(Some(
    read_nbt(&mut bytes.as_slice(), Flavor::GzCompressed)?.0,
  ))
}

async fn load_level_nbt(path: &Path) -> SJMCLResult<NbtCompound> {
  let level = read_nbt_file(path)
    .await
    .map_err(|err| {
      log::warn!(
        "Failed to read world level data at {}: {:?}",
        path.display(),
        err
      );
      InstanceError::LevelParseError
    })?
    .ok_or(InstanceError::LevelNotExistError)?;
  level.get::<_, &NbtCompound>("Data").map_err(|err| {
    log::warn!("Invalid world level data at {}: {}", path.display(), err);
    InstanceError::LevelParseError
  })?;
  Ok(level)
}

pub async fn load_world_data_from_dir(path: &Path) -> SJMCLResult<WorldDetails> {
  // Both formats use level.dat's Data compound; 26.1+ moves some fields to external files.
  // https://minecraft.wiki/w/Java_Edition_level_format
  let level = load_level_nbt(&path.join("level.dat")).await?;
  let data = level.get::<_, &NbtCompound>("Data")?;

  // Optional metadata files in the 26.1+ layout.
  let mut files = vec![
    "data/minecraft/world_gen_settings.dat".to_string(),
    "data/minecraft/weather.dat".to_string(),
    "data/minecraft/game_rules.dat".to_string(),
    "data/minecraft/wandering_trader.dat".to_string(),
    "dimensions/minecraft/overworld/data/minecraft/world_border.dat".to_string(),
  ];

  // 26.1+ replaces Player with singleplayer_uuid, referencing players/data/<uuid>.dat.
  // https://minecraft.wiki/w/Player.dat_format
  if !data.contains_key("Player")
    && let Some(tag) = data.inner().get("singleplayer_uuid")
  {
    match tag {
      NbtTag::IntArray(parts) if parts.len() == 4 => {
        // Preserve the bits of the four signed UUID words, most significant first.
        let most = ((parts[0] as u32 as u64) << 32) | parts[1] as u32 as u64;
        let least = ((parts[2] as u32 as u64) << 32) | parts[3] as u32 as u64;
        files.push(format!(
          "players/data/{}.dat",
          Uuid::from_u64_pair(most, least)
        ));
      }
      _ => log::warn!("Invalid singleplayer_uuid in {}", path.display()),
    }
  }

  let mut details = WorldDetails::from([(
    "level.dat".to_string(),
    nbt_to_display_value(NbtTag::Compound(level)),
  )]);
  for file in files {
    let file_path = path.join(&file);
    match read_nbt_file(&file_path).await {
      Ok(Some(data)) => {
        details.insert(file, nbt_to_display_value(NbtTag::Compound(data)));
      }
      Ok(None) if file.starts_with("players/") => {
        log::warn!("Missing world player data at {}", file_path.display());
      }
      Ok(None) => {}
      Err(err) => log::warn!(
        "Failed to read world data at {}: {:?}",
        file_path.display(),
        err
      ),
    }
  }
  Ok(details)
}

fn level_data_to_world_info(data: &NbtCompound) -> SJMCLResult<(i64, String, String)> {
  // Prefer 26.1+ difficulty_settings; fall back to the legacy top-level tags.
  let settings = data
    .inner()
    .get("difficulty_settings")
    .map(<&NbtCompound>::try_from)
    .transpose()?;
  let hardcore = settings
    .and_then(|s| s.inner().get("hardcore"))
    .or_else(|| data.inner().get("hardcore"))
    .map(bool::try_from)
    .transpose()?
    .unwrap_or(false);

  const DIFFICULTIES: [&str; 4] = ["peaceful", "easy", "normal", "hard"];
  let difficulty = if let Some(tag) = settings.and_then(|s| s.inner().get("difficulty")) {
    let value = <&str>::try_from(tag)?;
    if !DIFFICULTIES.contains(&value) {
      return Err(SJMCLError(format!("Invalid world difficulty: {}", value)));
    }
    value
  } else {
    let value = data
      .inner()
      .get("Difficulty")
      .map(u8::try_from)
      .transpose()?
      .unwrap_or(2);
    DIFFICULTIES
      .get(value as usize)
      .copied()
      .ok_or_else(|| SJMCLError(format!("Invalid world difficulty: {}", value)))?
  };

  const GAMEMODES: [&str; 4] = ["survival", "creative", "adventure", "spectator"];
  // Worlds predating game modes have no GameType and are always survival.
  let game_type = data
    .inner()
    .get("GameType")
    .map(i32::try_from)
    .transpose()?
    .unwrap_or(0);
  let gamemode = GAMEMODES
    .get(game_type as usize)
    .ok_or_else(|| SJMCLError(format!("Invalid world game type: {}", game_type)))?;

  Ok((
    data.get::<_, i64>("LastPlayed")? / 1000,
    if hardcore { "hardcore" } else { difficulty }.to_string(),
    gamemode.to_string(),
  ))
}
