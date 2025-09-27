use crate::error::{SJMCLError, SJMCLResult};
use crate::launcher_config::models::{JavaInfo, LauncherConfig};
use crate::resource::helpers::misc::{get_download_api, get_source_priority_list};
use crate::resource::models::ResourceType;
use crate::tasks::{download::DownloadParam, PTaskParam};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

#[cfg(target_os = "windows")]
use std::error::Error;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub async fn refresh_and_update_javas(app: &AppHandle) {
  // get java paths from system PATH, etc.
  let mut java_paths = get_java_paths(app);

  // add user-added paths from config state.
  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let mut config_state = config_binding.lock().unwrap();
  let extra_java_paths = config_state.extra_java_paths.clone();
  java_paths.extend(extra_java_paths.clone());

  let mut seen_paths: HashMap<String, JavaInfo> = HashMap::new();

  for java_exec_path in java_paths {
    let java_path_buf = PathBuf::from(&java_exec_path);
    let (vendor, full_version) = match get_java_info_from_release_file(&java_exec_path)
      .or_else(|| get_java_info_from_command(&java_exec_path))
    {
      Some(info) => info,
      None => continue,
    };

    let java_bin_path = java_path_buf
      .parent()
      .unwrap_or_else(|| Path::new(""))
      .to_path_buf();
    #[cfg(target_os = "windows")]
    let is_jdk = java_bin_path.join("javac.exe").exists();
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    let is_jdk = java_bin_path.join("javac").exists();

    let (major_version, is_lts) = parse_java_major_version(&full_version);
    let is_user_added = extra_java_paths.contains(&java_exec_path);

    let java_info = JavaInfo {
      name: format!("{} {}", if is_jdk { "JDK" } else { "JRE" }, full_version),
      major_version,
      is_lts,
      exec_path: java_exec_path.clone(),
      vendor,
      is_user_added,
    };

    seen_paths.entry(java_exec_path).or_insert(java_info);
  }

  let mut java_list: Vec<JavaInfo> = seen_paths.into_values().collect();
  java_list.sort_by(|a, b| {
    b.major_version
      .cmp(&a.major_version)
      .then_with(|| a.exec_path.len().cmp(&b.exec_path.len()))
  });

  // check selected java in global game config, if not exist, remove it.
  let current_selected_java = &config_state.global_game_config.game_java.exec_path;
  let is_valid_java = java_list
    .iter()
    .any(|java| &java.exec_path == current_selected_java);
  if !is_valid_java {
    config_state.global_game_config.game_java.exec_path = "".to_string();
  }

  let javas_binding = app.state::<Mutex<Vec<JavaInfo>>>();
  let mut javas_state = javas_binding.lock().unwrap();
  *javas_state = java_list;
}

pub fn get_java_paths(app: &AppHandle) -> Vec<String> {
  let mut paths = HashSet::new();

  // List java paths from System PATH variable
  #[cfg(target_os = "windows")]
  let command_output = Command::new("where")
    .arg("java")
    // See https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags
    .creation_flags(0x08000000) // CREATE_NO_WINDOW
    .output();

  #[cfg(any(target_os = "macos", target_os = "linux"))]
  let command_output = Command::new("which").args(["-a", "java"]).output();

  if let Ok(output) = command_output {
    if output.status.success() {
      let stdout = String::from_utf8_lossy(&output.stdout);
      for line in stdout.lines() {
        let path = line.trim();
        if path.is_empty() {
          continue;
        }
        if let Ok(resolved_path) = fs::canonicalize(path) {
          paths.insert(resolved_path.to_string_lossy().into_owned());
        }
      }
    }
  }

  // Scan java paths from common dirs
  for java_path in scan_java_paths_in_common_directories(app) {
    paths.insert(java_path);
  }

  // Scan Mojang Java downloaded by SJMCL itself
  for java_path in scan_java_paths_in_sjmcl_data_directory(app) {
    paths.insert(java_path);
  }

  // Scan java paths in all configured game directories (may downloaded by PCL)
  for java_path in scan_java_paths_in_game_directories(app) {
    paths.insert(java_path);
  }

  // For windows, try to get java path from registry
  #[cfg(target_os = "windows")]
  {
    for java_path in get_java_paths_from_windows_registry() {
      paths.insert(java_path);
    }
  }

  // For macOS, run "/usr/libexec/java_home -V" additionally
  #[cfg(target_os = "macos")]
  {
    if let Ok(output) = Command::new("/usr/libexec/java_home").arg("-V").output() {
      if output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        for line in stderr.lines() {
          let trimmed = line.trim();
          // Don't use `split_whitespace().last()` because the path may contain spaces.
          if let Some(idx) = trimmed.rfind('"') {
            let path_part = &trimmed[idx + 1..].trim();
            if !path_part.is_empty() {
              let java_bin = PathBuf::from(path_part).join("bin/java");
              if let Ok(resolved_path) = fs::canonicalize(java_bin) {
                paths.insert(resolved_path.to_string_lossy().into_owned());
              }
            }
          }
        }
      }
    }
  }

  // For Windows, remove "\\?\" prefix from paths
  #[cfg(target_os = "windows")]
  {
    paths
      .into_iter()
      .map(|path| path.trim_start_matches(r"\\?\").to_string())
      .collect()
  }

  #[cfg(not(target_os = "windows"))]
  {
    paths.into_iter().collect()
  }
}

// Get canonicalized java path from Windows registry
#[cfg(target_os = "windows")]
fn get_java_paths_from_windows_registry() -> Vec<String> {
  let hklm = winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE);
  let registry_paths = [
    r"SOFTWARE\JavaSoft\JDK",
    r"SOFTWARE\JavaSoft\JRE",
    r"SOFTWARE\JavaSoft\Java Development Kit",
    r"SOFTWARE\JavaSoft\Java Runtime Environment",
  ];
  let mut java_paths = Vec::new();
  for base_path in registry_paths {
    if let Ok(java_path) = (|| {
      let current_version: String = hklm.open_subkey(base_path)?.get_value("CurrentVersion")?;
      let java_home: String = hklm
        .open_subkey(format!(r"{}\{}", base_path, current_version))?
        .get_value("JavaHome")?;
      let java_bin = PathBuf::from(java_home).join(r"bin\java.exe");
      Ok::<String, Box<dyn Error>>(fs::canonicalize(java_bin)?.to_string_lossy().into_owned())
    })() {
      java_paths.push(java_path);
    }
  }
  java_paths
}

fn scan_java_paths_in_common_directories(app: &AppHandle) -> Vec<String> {
  let mut java_paths = Vec::new();
  if let Ok(home_dir) = app.path().home_dir() {
    java_paths.extend(search_java_homes_in_directory(home_dir.join(".jdks")));
  }
  #[cfg(target_os = "windows")]
  {
    let common_vendors = [
      "Java",
      "BellSoft",
      "AdoptOpenJDK",
      "Zulu",
      "Microsoft",
      "Eclipse Foundation",
      "Semeru",
    ];
    for vendor in common_vendors {
      java_paths.extend(search_java_homes_in_directory(
        PathBuf::from(r"C:\Program Files").join(vendor),
      ));
      java_paths.extend(search_java_homes_in_directory(
        PathBuf::from(r"C:\Program Files (x86)").join(vendor),
      ));
    }
  }
  #[cfg(target_os = "linux")]
  {
    let common_dirs = [
      "/usr/java",
      "/usr/lib/jvm",
      "/usr/lib32/jvm",
      "/usr/lib64/jvm",
    ];
    for dir in common_dirs {
      java_paths.extend(search_java_homes_in_directory(PathBuf::from(dir)));
    }
    if let Ok(home) = app.path().home_dir() {
      java_paths.extend(search_java_homes_in_directory(
        home.join(".sdkman/candidates/java"),
      ));
    }
  }
  #[cfg(target_os = "macos")]
  {
    let common_javas = [
      "/Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home",
      "/Applications/Xcode.app/Contents/Applications/Application Loader.app/Contents/MacOS/itms/java",
      "/opt/homebrew/opt/java",
    ];
    for java in common_javas {
      java_paths.extend(resolve_java_home(PathBuf::from(java)));
    }
    java_paths.extend(search_java_homes_in_mac_java_virtual_machines(
      PathBuf::from("/Library/Java/JavaVirtualMachines"),
    ));
    if let Ok(home) = app.path().home_dir() {
      java_paths.extend(search_java_homes_in_mac_java_virtual_machines(
        home.join("Library/Java/JavaVirtualMachines"),
      ));
    }
    if let Ok(entries) = fs::read_dir(PathBuf::from("/opt/homebrew/Cellar")) {
      for entry in entries.flatten() {
        let path = entry.path();
        if let Some(name) = path.file_name() {
          if name.to_string_lossy().starts_with("openjdk") {
            java_paths.extend(search_java_homes_in_directory(path));
          }
        }
      }
    }
  }
  java_paths
}

fn scan_java_paths_in_sjmcl_data_directory(app: &AppHandle) -> Vec<String> {
  let mut java_paths = Vec::new();
  #[cfg(any(target_os = "linux", target_os = "windows"))]
  {
    if let Ok(app_data_dir) = app.path().app_data_dir() {
      java_paths.extend(search_java_homes_in_directory(app_data_dir.join("runtime")));
    }
    // TODO: test on the Linux.
  }
  #[cfg(target_os = "macos")]
  {
    if let Ok(rt) = app.path().app_data_dir().map(|p| p.join("runtime")) {
      for v in [8, 11, 17, 21] {
        java_paths.extend(search_java_homes_in_mac_java_virtual_machines(
          rt.join(format!("java-{v}")),
        ));
      }
    }
  }
  java_paths
}

fn scan_java_paths_in_game_directories(app: &AppHandle) -> Vec<String> {
  let mut java_paths = Vec::new();
  let config_binding = app.state::<Mutex<LauncherConfig>>();
  if let Ok(config_state) = config_binding.lock() {
    for game_dir in &config_state.local_game_directories {
      let runtime_dir = game_dir.dir.join("runtime");
      if runtime_dir.exists() {
        java_paths.extend(search_java_homes_in_directory(runtime_dir));
      }
    }
  }
  java_paths
}

fn search_java_homes_in_directory(dir: PathBuf) -> Vec<String> {
  let mut java_paths = Vec::new();
  if let Ok(entries) = fs::read_dir(dir) {
    for entry in entries.flatten() {
      let java_home = entry.path();
      if let Ok(java_path) = resolve_java_home(java_home) {
        java_paths.push(java_path);
      }
    }
  }
  java_paths
}

#[cfg(target_os = "macos")]
fn search_java_homes_in_mac_java_virtual_machines(dir: PathBuf) -> Vec<String> {
  let mut java_paths = Vec::new();
  if let Ok(entries) = fs::read_dir(dir) {
    for entry in entries.flatten() {
      let java_home = entry.path().join("Contents/Home");
      if let Ok(java_path) = resolve_java_home(java_home) {
        java_paths.push(java_path);
      }
    }
  }
  java_paths
}

fn resolve_java_home(path: PathBuf) -> SJMCLResult<String> {
  #[cfg(target_os = "windows")]
  let java_bin = path.join(r"bin\java.exe");
  #[cfg(not(target_os = "windows"))]
  let java_bin = path.join("bin/java");
  Ok(fs::canonicalize(java_bin)?.to_string_lossy().into_owned())
}

pub fn get_java_info_from_release_file(java_path: &str) -> Option<(String, String)> {
  // Typically, executable files are located in .../Home/bin/java, release file and bin folder are at the same level.
  let java_path_buf = PathBuf::from(java_path);
  let java_home = java_path_buf.parent()?.parent()?;
  let release_file = java_home.join("release");

  if !release_file.exists() {
    return None;
  }

  let content = fs::read_to_string(release_file).ok()?;
  let mut vendor = "Oracle Corporation".to_string();
  let mut full_version = "0".to_string();

  // Try to parse info from release file
  for line in content.lines() {
    if line.starts_with("JAVA_VERSION=") {
      let quoted = line.split('=').nth(1)?.trim().trim_matches('"');
      full_version = quoted.to_string();
    } else if line.starts_with("IMPLEMENTOR=") {
      let quoted = line.split('=').nth(1)?.trim().trim_matches('"');
      vendor = quoted.to_string();
    }
  }

  if full_version == "0" {
    None
  } else {
    Some((vendor, full_version))
  }
}

pub fn get_java_info_from_command(java_path: &str) -> Option<(String, String)> {
  // use "java -version -XshowSettings:properties" command to get info
  #[cfg(target_os = "windows")]
  let output = Command::new(java_path)
    .args(["-XshowSettings:properties", "-version"])
    .creation_flags(0x08000000) // CREATE_NO_WINDOW
    .output()
    .ok()?;
  #[cfg(any(target_os = "macos", target_os = "linux"))]
  let output = Command::new(java_path)
    .args(["-XshowSettings:properties", "-version"])
    .output()
    .ok()?;

  if !output.status.success() {
    return None;
  }

  let mut output_str = String::new();
  output_str.push_str(&String::from_utf8_lossy(&output.stdout));
  output_str.push_str(&String::from_utf8_lossy(&output.stderr));

  let mut vendor = "Unknown".to_string();
  let mut full_version = "0".to_string();

  for line in output_str.lines() {
    if line.trim().starts_with("java.vendor = ") {
      vendor = line.split('=').nth(1)?.trim().trim_matches('"').to_string();
    }
    if line.trim().starts_with("java.version = ") {
      full_version = line.split('=').nth(1)?.trim().trim_matches('"').to_string();
    }
  }

  Some((vendor, full_version))
}

pub fn parse_java_major_version(full_version: &str) -> (i32, bool) {
  let major_version = if full_version.starts_with("1.") {
    // Java 1.x (e.g., 1.8 -> 8, 1.7 -> 7)
    full_version
      .split('.')
      .nth(1)
      .unwrap_or("0")
      .parse::<i32>()
      .unwrap_or(0)
  } else {
    // Java 9+
    full_version
      .split('.')
      .next()
      .unwrap_or("0")
      .parse::<i32>()
      .unwrap_or(0)
  };

  let is_lts = [8, 11, 17, 21, 25].contains(&major_version);
  (major_version, is_lts)
}

pub async fn build_mojang_java_download_params(
  app: &AppHandle,
  version: &str,
) -> SJMCLResult<Vec<PTaskParam>> {
  let config = app.state::<Mutex<LauncherConfig>>().lock()?.clone();
  let client = app.state::<reqwest::Client>();

  let platform = match (&*config.basic_info.os_type, &*config.basic_info.arch) {
    ("windows", "aarch64") => "windows-arm64",
    ("windows", "x86_64") => "windows-x64",
    ("windows", _) => "windows-x86",
    ("macos", "aarch64") => "mac-os-arm64",
    ("macos", _) => "mac-os",
    ("linux", "x86_64") => "linux",
    _ => "linux-i386",
  };
  let runtime_type = match version {
    "8" => "jre-legacy",
    "21" => "java-runtime-delta",
    _ => "java-runtime-gamma",
  };

  let priority_list = get_source_priority_list(&config);
  let mut json: Option<Value> = None;

  for source_type in priority_list.iter() {
    if let Ok(api_url) = get_download_api(*source_type, ResourceType::MojangJava) {
      if let Ok(response) = client.get(api_url).send().await {
        if let Ok(parsed_json) = response.json::<Value>().await {
          json = Some(parsed_json);
          break;
        }
      }
    }
  }

  let json =
    json.ok_or_else(|| SJMCLError("Failed to fetch Mojang Java runtime manifest".into()))?;
  let manifest_url = json[platform][runtime_type][0]["manifest"]["url"]
    .as_str()
    .ok_or_else(|| SJMCLError("Failed to parse manifest URL".into()))?;

  let manifest: Value = client.get(manifest_url).send().await?.json().await?;
  let runtime_dir = app.path().resolve(
    format!("runtime/java-{}", version),
    tauri::path::BaseDirectory::AppData,
  )?;

  let download_params: Vec<_> = manifest["files"]
    .as_object()
    .ok_or_else(|| SJMCLError("Invalid files data".into()))?
    .iter()
    .filter_map(|(path, info)| {
      let raw = info["downloads"]["raw"].as_object()?;
      let (url, sha1) = (raw["url"].as_str()?, raw["sha1"].as_str()?);

      Some(PTaskParam::Download(DownloadParam {
        src: url.parse().ok()?,
        dest: runtime_dir.join(path),
        filename: None,
        sha1: Some(sha1.into()),
      }))
    })
    .collect();

  Ok(download_params)
}
