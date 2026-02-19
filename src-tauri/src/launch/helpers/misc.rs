use futures::future::join_all;
use lazy_static;
use regex::Regex;
use std::collections::HashMap;
use std::path::Path;
use tokio::fs;

use crate::error::SJMCLResult;
use crate::instance::helpers::asset_index::AssetIndex;
use crate::storage::load_json_async;

pub async fn check_virtual_assets(
  root_dir: &Path,
  assets_dir: &Path,
  assets_index_name: &str,
) -> SJMCLResult<()> {
  if assets_index_name != "legacy" && assets_index_name != "pre-1.6" {
    return Ok(());
  }
  let asset_index =
    load_json_async::<AssetIndex>(&assets_dir.join(format!("indexes/{}.json", assets_index_name)))
      .await?;

  let futs = asset_index
    .objects
    .into_iter()
    .map(|(name, item)| async move {
      let path_in_repo = format!("{}/{}", &item.hash[..2], item.hash);
      let origin = assets_dir.join(format!("objects/{}", path_in_repo));
      let target = match assets_index_name {
        "legacy" => assets_dir.join(format!("virtual/legacy/{}", name)),
        "pre-1.6" => root_dir.join(format!("resources/{}", name)),
        _ => unreachable!(),
      };

      if fs::try_exists(&origin).await? {
        if !fs::try_exists(&target).await? {
          copy_with_dirs(&origin, &target).await?;
        }
      }
      Ok(())
    });
  let _: Vec<SJMCLResult<()>> = join_all(futs).await;
  Ok(())
}

async fn copy_with_dirs(origin: &Path, target: &Path) -> std::io::Result<u64> {
  if let Some(parent) = target.parent() {
    fs::create_dir_all(parent).await?;
  }
  fs::copy(origin, target).await
}

pub fn replace_arguments(args: Vec<String>, map: &HashMap<String, String>) -> Vec<String> {
  lazy_static::lazy_static!(
    static ref PARAM_REGEX: Regex = Regex::new(r"\$\{([^}]+)\}").unwrap();
  );
  let mut cmd = Vec::new();
  for arg in args {
    let mut replaced_arg = arg.clone();
    let mut unknown_arg = false;

    for caps in PARAM_REGEX.captures_iter(&arg) {
      let arg_name = &caps[1];
      match map.get(arg_name) {
        Some(value) => {
          replaced_arg = replaced_arg.replacen(&caps[0], value, 1);
        }
        None => {
          unknown_arg = true;
          break;
        }
      }
    }
    if !unknown_arg {
      cmd.push(replaced_arg);
    } else {
      cmd.push(arg);
    }
  }
  cmd
}

pub fn get_natives_string(natives: &HashMap<String, String>) -> Option<String> {
  let target_os: String = if cfg!(target_os = "windows") {
    "windows".to_string()
  } else if cfg!(target_os = "linux") {
    "linux".to_string()
  } else if cfg!(target_os = "macos") {
    "osx".to_string()
  } else {
    "other".to_string()
  };
  if let Some(native) = natives.get(&target_os) {
    let mut map = HashMap::<String, String>::new();
    let arch = std::mem::size_of::<usize>() * 8;
    map.insert("arch".to_string(), arch.to_string());
    replace_arguments(vec![native.clone()], &map).pop()
  } else {
    None
  }
}

pub fn get_separator() -> &'static str {
  if cfg!(windows) {
    ";"
  } else {
    ":"
  }
}
