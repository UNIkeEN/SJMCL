use lazy_static;
use regex::Regex;
use std::collections::HashMap;

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

pub fn parse_graphics_environment_variable(input: &str) -> HashMap<String, String> {
  const GRAPHICS_ENV_NAMES: &[&str] = &[
    "__GLX_VENDOR_LIBRARY_NAME",
    "VK_ICD_FILENAMES",
    "VK_DRIVER_FILES",
    "GALLIUM_DRIVER",
    "MESA_LOADER_DRIVER_OVERRIDE",
    "LIBGL_ALWAYS_SOFTWARE",
    "LIBGL_KOPPER_DRI2",
  ];

  shlex::split(input)
    .unwrap_or_default()
    .into_iter()
    .find_map(|item| {
      let (key, value) = item.split_once('=').unwrap_or((&item, ""));
      let key = key.trim();

      if GRAPHICS_ENV_NAMES.contains(&key) {
        Some((key.to_string(), value.to_string()))
      } else {
        None
      }
    })
    .into_iter()
    .collect()
}
