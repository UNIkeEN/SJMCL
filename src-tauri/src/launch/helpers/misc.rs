use crate::launcher_config::models::GraphicsApi;
use lazy_static;
use regex::Regex;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

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

pub fn parse_environment_variables(input: &str) -> HashMap<String, String> {
  shlex::split(input)
    .unwrap_or_default()
    .into_iter()
    .map(|item| {
      let (key, value) = item.split_once('=').unwrap_or((&item, ""));
      (key.trim().to_string(), value.to_string())
    })
    .into_iter()
    .collect()
}

pub fn build_graphics_environment_variables(
  api: &GraphicsApi,
  renderer: &str,
  mesa_loader_dir: Option<&Path>,
) -> HashMap<String, String> {
  let renderer = renderer.trim().to_ascii_lowercase();
  let mut env = HashMap::new();

  match api {
    GraphicsApi::Opengl => match renderer.as_str() {
      "llvmpipe" => {
        env.insert("__GLX_VENDOR_LIBRARY_NAME".to_string(), "mesa".to_string());
        env.insert("LIBGL_ALWAYS_SOFTWARE".to_string(), "1".to_string());
      }
      "zink" => {
        env.insert("__GLX_VENDOR_LIBRARY_NAME".to_string(), "mesa".to_string());
        env.insert(
          "MESA_LOADER_DRIVER_OVERRIDE".to_string(),
          "zink".to_string(),
        );
        env.insert("LIBGL_KOPPER_DRI2".to_string(), "1".to_string());
      }
      "d3d12" => {
        env.insert("GALLIUM_DRIVER".to_string(), "d3d12".to_string());
        env.insert(
          "MESA_LOADER_DRIVER_OVERRIDE".to_string(),
          "d3d12".to_string(),
        );
      }
      _ => {}
    },
    GraphicsApi::Vulkan => {
      if let Some(icd_name) = mesa_vulkan_icd_name(&renderer) {
        if let Some(mesa_loader_dir) = mesa_loader_dir {
          let icd_file = mesa_loader_dir.join(format!("{icd_name}_icd.json"));
          let icd_file = icd_file.to_string_lossy().to_string();
          env.insert("VK_ICD_FILENAMES".to_string(), icd_file.clone());
          env.insert("VK_DRIVER_FILES".to_string(), icd_file);
          return env;
        }
      }

      if let Some(icd_file) = find_vulkan_icd_file(&renderer) {
        let icd_file = icd_file.to_string_lossy().to_string();
        env.insert("VK_ICD_FILENAMES".to_string(), icd_file.clone());
        env.insert("VK_DRIVER_FILES".to_string(), icd_file);
      }
    }
    GraphicsApi::Default => {}
  }

  env
}

pub fn mesa_driver_name(api: &GraphicsApi, renderer: &str) -> Option<&'static str> {
  let renderer = renderer.trim().to_ascii_lowercase();
  match api {
    GraphicsApi::Opengl => match renderer.as_str() {
      "llvmpipe" => Some("llvmpipe"),
      "zink" => Some("zink"),
      "d3d12" => Some("d3d12"),
      _ => None,
    },
    GraphicsApi::Vulkan => match renderer.as_str() {
      "lavapipe" => Some("lavapipe"),
      "dozen" => Some("dzn"),
      _ => None,
    },
    GraphicsApi::Default => None,
  }
}

fn mesa_vulkan_icd_name(renderer: &str) -> Option<&'static str> {
  match renderer {
    "lavapipe" => Some("lvp"),
    "dozen" => Some("dzn"),
    _ => None,
  }
}

fn find_vulkan_icd_file(renderer: &str) -> Option<PathBuf> {
  let candidates = match renderer {
    "lavapipe" => &["lvp"][..],
    "dozen" => &["dzn"],
    "nvidia_vulkan" => &["nvidia", "nv-vk64", "nv-vk32"],
    "nvidia_nvk" => &["nouveau"],
    "amdvlk" => &["amd", "amd-vulkan64", "amd-vulkan32"],
    "amd_radv" => &["radeon"],
    "intel_vulkan" => &["ig", "igvk64", "igvk32"],
    "intel_anv" => &["intel"],
    "intel_hasvk" => &["intel_hasvk"],
    "qualcomm" => &["qc", "qcvk_icd_arm64x"],
    "turnip" => &["freedreno"],
    "moltenvk" => &["MoltenVK"],
    "kosmickrisp" => &["kosmickrisp_mesa"],
    "powervr" => &["powervr"],
    "panvk" => &["panfrost"],
    "v3dv" => &["broadcom"],
    _ => return None,
  };

  vulkan_icd_dirs()
    .into_iter()
    .find_map(|dir| find_icd_file_in_dir(&dir, candidates))
}

fn vulkan_icd_dirs() -> Vec<PathBuf> {
  let mut dirs = Vec::new();

  #[cfg(target_os = "linux")]
  {
    dirs.push(PathBuf::from("/usr/share/vulkan/icd.d"));
    dirs.push(PathBuf::from("/etc/vulkan/icd.d"));
  }

  #[cfg(target_os = "macos")]
  {
    dirs.push(PathBuf::from("/opt/homebrew/share/vulkan/icd.d"));
    dirs.push(PathBuf::from("/usr/local/share/vulkan/icd.d"));
  }

  #[cfg(target_os = "windows")]
  {
    if let Some(program_files) = std::env::var_os("ProgramFiles") {
      dirs.push(PathBuf::from(program_files).join("VulkanRT"));
    }
    if let Some(program_files_x86) = std::env::var_os("ProgramFiles(x86)") {
      dirs.push(PathBuf::from(program_files_x86).join("VulkanRT"));
    }
  }

  dirs
}

fn find_icd_file_in_dir(dir: &Path, candidates: &[&str]) -> Option<PathBuf> {
  let entries = std::fs::read_dir(dir).ok()?;

  for entry in entries.flatten() {
    let path = entry.path();

    if path.is_dir() {
      if let Some(icd_file) = find_icd_file_in_dir(&path, candidates) {
        return Some(icd_file);
      }
      continue;
    }

    let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
      continue;
    };
    if !file_name.ends_with(".json") {
      continue;
    }

    if candidates.iter().any(|candidate| {
      file_name.eq_ignore_ascii_case(&format!("{candidate}.json"))
        || file_name
          .to_ascii_lowercase()
          .starts_with(&format!("{}_", candidate.to_ascii_lowercase()))
    }) {
      return Some(path);
    }
  }

  None
}
