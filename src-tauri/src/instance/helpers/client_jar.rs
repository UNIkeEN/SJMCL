// https://zh.minecraft.wiki/w/%E7%89%88%E6%9C%AC%E4%BF%A1%E6%81%AF%E6%96%87%E4%BB%B6%E6%A0%BC%E5%BC%8F

use cafebabe::constant_pool::{ConstantPoolItem, LiteralConstant};
use cafebabe::parse_class;
use serde_json::Value;
use std::io::{Read, Seek};
use zip::ZipArchive;

// ref: HMCL org.jackhuang.hmcl.game.GameVersion

fn from_json<R: Read + Seek>(jar: &mut ZipArchive<R>) -> Option<String> {
  let file = jar.by_name("version.json").ok()?;
  let json_value: Value = serde_json::from_reader(file).ok()?;
  json_value
    .get("id")
    .and_then(Value::as_str)
    .map(|id| id.split(" / ").next().unwrap().to_string())
}

fn from_client<R: Read + Seek>(jar: &mut ZipArchive<R>) -> Option<String> {
  let mut file = jar.by_name("net/minecraft/client/Minecraft.class").ok()?;
  let mut buffer = Vec::new();
  file.read_to_end(&mut buffer).ok()?;
  let class = parse_class(&buffer).ok()?;
  class
    .constantpool_iter()
    .filter_map(|item| match item {
      ConstantPoolItem::LiteralConstant(LiteralConstant::String(s)) => Some(s),
      _ => None,
    })
    .find_map(|s| {
      s.strip_prefix("Minecraft Minecraft ")
        .map(|ver| ver.to_string())
    })
}

fn from_server<R: Read + Seek>(jar: &mut ZipArchive<R>) -> Option<String> {
  let mut file = jar
    .by_name("net/minecraft/server/MinecraftServer.class")
    .ok()?;
  let mut buffer = Vec::new();
  file.read_to_end(&mut buffer).ok()?;
  let class = parse_class(&buffer).ok()?;
  let strings: Vec<_> = class
    .constantpool_iter()
    .filter_map(|item| match item {
      ConstantPoolItem::LiteralConstant(LiteralConstant::String(s)) => Some(s),
      _ => None,
    })
    .collect();

  let idx = strings
    .iter()
    .position(|s| s.starts_with("Can't keep up!"))?;

  strings[..idx]
    .iter()
    .rev()
    .find(|s| s.chars().any(|c| c.is_ascii_digit()))
    .map(|s| s.to_string())
}

pub fn load_game_version_from_jar<R: Read + Seek>(jar: &mut ZipArchive<R>) -> Option<String> {
  if let Some(version) = from_json(jar) {
    return Some(version);
  }
  if let Some(version) = from_client(jar) {
    if version.starts_with("Beta ") {
      return Some(format!("b{}", version.strip_prefix("Beta ").unwrap()));
    }
    return Some(version);
  }
  if let Some(version) = from_server(jar) {
    return Some(version);
  }
  None
}

// pub fn load_image_from_jar<R: Read + Seek>(jar: &mut ZipArchive<R>) -> SJMCLResult<String> {
//   if let Ok(mut file) = jar.by_name("pack.png") {
//     let mut buffer = Vec::new();
//     file.read_to_end(&mut buffer)?;
//     // Use `image` crate to decode the image
//     let img = ImageReader::new(Cursor::new(buffer))
//       .with_guessed_format()?
//       .decode()?;
//     if let Ok(b64) = image_to_base64(img.to_rgba8()) {
//       return Ok(b64);
//     }
//   }
//   Err(SJMCLError("pack.png not found in jar".to_string()))
// }
