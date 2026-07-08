use std::path::{Path, PathBuf};

use crate::launcher_config::models::GraphicsApi;

pub fn supported_graphics_renderers(api: &GraphicsApi) -> Vec<String> {
  match api {
    GraphicsApi::Default => vec!["default".to_string()],
    GraphicsApi::Opengl => {
      let renderers = [
        "default",
        "llvmpipe",
        "zink",
        #[cfg(target_os = "windows")]
        "d3d12",
      ];

      renderers.into_iter().map(str::to_string).collect()
    }
    GraphicsApi::Vulkan => {
      let mut renderers = vec!["default"];

      #[cfg(target_os = "windows")]
      {
        renderers.extend(["lavapipe", "dozen"]);
      }

      #[cfg(target_os = "macos")]
      {
        renderers.push("moltenvk");
      }

      for renderer in [
        "lavapipe",
        "dozen",
        "nvidia_vulkan",
        "nvidia_nvk",
        "amdvlk",
        "amd_radv",
        "intel_vulkan",
        "intel_anv",
        "intel_hasvk",
        "qualcomm",
        "turnip",
        "moltenvk",
        "kosmickrisp",
        "powervr",
        "panvk",
        "v3dv",
      ] {
        if renderers.contains(&renderer) {
          continue;
        }
        if find_vulkan_icd_file(renderer).is_some() {
          renderers.push(renderer);
        }
      }

      renderers.into_iter().map(str::to_string).collect()
    }
  }
}

#[cfg(target_os = "windows")]
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

#[cfg(target_os = "windows")]
pub fn mesa_vulkan_icd_name(renderer: &str) -> Option<&'static str> {
  match renderer {
    "lavapipe" => Some("lvp"),
    "dozen" => Some("dzn"),
    _ => None,
  }
}

pub fn find_vulkan_icd_file(renderer: &str) -> Option<PathBuf> {
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

#[cfg(target_os = "macos")]
pub fn find_macos_libvulkan() -> Option<PathBuf> {
  [
    "/opt/homebrew/lib/libvulkan.1.dylib",
    "/usr/local/lib/libvulkan.1.dylib",
  ]
  .into_iter()
  .map(PathBuf::from)
  .find(|path| path.is_file())
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
