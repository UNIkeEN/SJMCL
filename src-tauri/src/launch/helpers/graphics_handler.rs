use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::launcher_config::helpers::graphics::find_vulkan_icd_file;
use crate::launcher_config::models::GraphicsApi;

#[cfg(target_os = "windows")]
use crate::launcher_config::helpers::graphics::mesa_vulkan_icd_name;

fn set_vulkan_icd_file(env: &mut HashMap<String, String>, icd_file: PathBuf) {
  let icd_file = icd_file.to_string_lossy().to_string();
  env.insert("VK_ICD_FILENAMES".to_string(), icd_file.clone());
  env.insert("VK_DRIVER_FILES".to_string(), icd_file);
}

pub fn parse_environment_variables(input: &str) -> HashMap<String, String> {
  shlex::split(input)
    .unwrap_or_default()
    .into_iter()
    .map(|item| {
      let (key, value) = item.split_once('=').unwrap_or((&item, ""));
      (key.trim().to_string(), value.to_string())
    })
    .collect()
}

pub fn build_graphics_environment_variables(
  api: &GraphicsApi,
  renderer: &str,
  _mesa_loader_dir: Option<&Path>,
) -> HashMap<String, String> {
  let renderer = renderer.trim().to_ascii_lowercase();
  let mut env = HashMap::new();

  #[cfg(target_os = "windows")]
  {
    match api {
      GraphicsApi::Opengl => match renderer.as_str() {
        "zink" | "d3d12" => {
          env.insert("GALLIUM_DRIVER".to_string(), renderer.clone());
        }
        _ => {}
      },
      GraphicsApi::Vulkan => {
        if let Some(icd_name) = mesa_vulkan_icd_name(&renderer)
          && let Some(mesa_loader_dir) = _mesa_loader_dir
        {
          set_vulkan_icd_file(
            &mut env,
            mesa_loader_dir.join(format!("{icd_name}_icd.json")),
          );
        } else if let Some(icd_file) = find_vulkan_icd_file(&renderer) {
          set_vulkan_icd_file(&mut env, icd_file);
        }
      }
      GraphicsApi::Default => {}
    }
  }

  #[cfg(any(target_os = "linux", target_os = "freebsd"))]
  {
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
        _ => {}
      },
      GraphicsApi::Vulkan => {
        if let Some(icd_file) = find_vulkan_icd_file(&renderer) {
          set_vulkan_icd_file(&mut env, icd_file);
        }
      }
      GraphicsApi::Default => {}
    }
  }

  #[cfg(target_os = "macos")]
  {
    if let GraphicsApi::Vulkan = api
      && renderer != "moltenvk"
      && let Some(icd_file) = find_vulkan_icd_file(&renderer)
    {
      set_vulkan_icd_file(&mut env, icd_file);
    }
  }

  env
}
