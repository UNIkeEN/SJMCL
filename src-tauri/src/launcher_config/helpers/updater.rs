use serde_json::Value;
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::download::DownloadTask;
use crate::download::submit_download_group;
use crate::launcher_config::models::{LauncherConfig, LauncherConfigError};

// Base URL of the update service (the "Downloader" install center used by iOS Club).
// Injected at build time from `XJMC_UPDATE_BASE`; when unset, update checking is disabled
// instead of falling back to an unknown host.
const UPDATE_SERVICE_BASE: Option<&str> = option_env!("XJMC_UPDATE_BASE");
// Identifier of this client inside the update service.
const UPDATE_SERVICE_APP_ID: Option<&str> = option_env!("XJMC_UPDATE_APP_ID");

fn update_service_endpoint() -> Option<String> {
  let base = UPDATE_SERVICE_BASE?.trim().trim_end_matches('/');
  let app_id = UPDATE_SERVICE_APP_ID?.trim();
  if base.is_empty() || app_id.is_empty() {
    return None;
  }
  Some(format!("{base}/api/app/{app_id}/latest"))
}

// Score how well an asset URL matches the current platform, so that a release
// carrying several platform builds still resolves to a single downloadable file.
fn soft_score(url: &str, os: &str, arch: &str) -> u8 {
  let url = url.to_ascii_lowercase();
  let os_tokens: &[&str] = match os {
    "windows" => &["windows", "win64", "win32"],
    "macos" => &["macos", "darwin", "osx"],
    "linux" => &["linux", "appimage", "deb", "rpm"],
    _ => &[],
  };
  let arch_tokens: &[&str] = match arch {
    "aarch64" => &["aarch64", "arm64"],
    "x86" => &["i686", "x86_32", "win32"],
    _ => &["x86_64", "x64", "amd64"],
  };

  let mut score = 0;
  if os_tokens.iter().any(|token| url.contains(token)) {
    score += 2;
  }
  if arch_tokens.iter().any(|token| url.contains(token)) {
    score += 1;
  }
  score
}

// Pick the asset of the current platform; a release asset must at least match the OS.
fn pick_soft_url(softs: &[Value], os: &str, arch: &str) -> Option<String> {
  softs
    .iter()
    .filter_map(|soft| {
      let url = soft.get("softUrl")?.as_str()?.to_string();
      Some((soft_score(&url, os, arch), url))
    })
    .filter(|(score, _)| *score >= 2)
    .max_by_key(|(score, _)| *score)
    .map(|(_, url)| url)
}

// Generate the new filename on the local disk.
// If old_name contains old_version, replace the first occurrence with new_version.
// Otherwise, keep the old_name unchanged.
fn build_local_new_filename(old_name: &str, old_version: &str, new_version: &str) -> String {
  if let Some(idx) = old_name.find(old_version) {
    let mut s = String::with_capacity(old_name.len() - old_version.len() + new_version.len());
    s.push_str(&old_name[..idx]);
    s.push_str(new_version);
    s.push_str(&old_name[idx + old_version.len()..]);
    s
  } else {
    old_name.to_string()
  }
}

pub async fn fetch_latest_version(
  app: &AppHandle,
) -> SJMCLResult<Option<(String, String, String, String)>> {
  let Some(endpoint) = update_service_endpoint() else {
    return Ok(None);
  };

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let (os, arch) = {
    let config_state = config_binding.lock()?;
    (
      config_state.basic_info.os_type.clone(),
      config_state.basic_info.arch.clone(),
    )
  };
  let client = app.state::<reqwest::Client>();

  let response = client
    .get(&endpoint)
    .send()
    .await
    .map_err(|_| LauncherConfigError::FetchError)?
    .json::<Value>()
    .await
    .map_err(|_| LauncherConfigError::FetchError)?;

  let version = response
    .get("releaseId")
    .and_then(|value| value.as_str())
    .map(|version| version.trim_start_matches('v').to_string())
    .ok_or(LauncherConfigError::FetchError)?;

  let softs = response
    .get("softs")
    .and_then(|value| value.as_array())
    .map(Vec::as_slice)
    .unwrap_or_default();
  let download_url =
    pick_soft_url(softs, os.as_str(), arch.as_str()).ok_or(LauncherConfigError::FetchError)?;

  let release_notes = response
    .get("context")
    .and_then(|value| value.as_str())
    .unwrap_or_default()
    .to_string();
  let published_at = response
    .get("releaseDate")
    .and_then(|value| value.as_str())
    .unwrap_or_default()
    .to_string();

  Ok(Some((version, download_url, release_notes, published_at)))
}

pub async fn download_target_version(app: &AppHandle, download_url: String) -> SJMCLResult<()> {
  let download_cache_dir = {
    let config_binding = app.state::<Mutex<LauncherConfig>>();
    config_binding.lock()?.download.cache.directory.clone()
  };

  let source = url::Url::parse(&download_url).map_err(|_| LauncherConfigError::FetchError)?;
  let fname = source
    .path_segments()
    .and_then(|mut segments| segments.next_back())
    .filter(|name| !name.is_empty())
    .map(str::to_string)
    .ok_or(LauncherConfigError::FetchError)?;

  submit_download_group(
    app.clone(),
    format!("launcher-update?{}", fname),
    vec![DownloadTask {
      sources: vec![source],
      dest: download_cache_dir.join(&fname),
      filename: Some(fname),
      size: None,
      sha1: None,
    }],
    true,
  )
  .await?;
  Ok(())
}

#[cfg(target_os = "windows")]
pub async fn install_update_windows(
  app: &AppHandle,
  downloaded_filename: String,
  restart: bool,
) -> SJMCLResult<()> {
  use std::os::windows::process::CommandExt;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let (old_version, downloaded_path, new_version, is_portable) = {
    let config_state = config_binding.lock()?;
    (
      config_state.basic_info.launcher_version.clone(),
      config_state
        .download
        .cache
        .directory
        .join(&downloaded_filename),
      downloaded_filename
        .split('_')
        .nth(1)
        .map(|s| s.to_string())
        .unwrap_or_else(|| config_state.basic_info.launcher_version.clone()),
      config_state.basic_info.is_portable,
    )
  };
  let cur_exe = std::env::current_exe()?;

  if is_portable {
    // Portable: replace current exe with the newly downloaded one via a temp cmd script.
    let cur_dir = cur_exe
      .parent()
      .ok_or_else(|| SJMCLError("No parent dir for exe".to_string()))?;
    let old_name = cur_exe
      .file_name()
      .and_then(|s| s.to_str())
      .ok_or_else(|| SJMCLError("Invalid exe name".to_string()))?
      .to_string();

    let target_name = build_local_new_filename(&old_name, &old_version, &new_version);
    let target = cur_dir.join(target_name);
    let pid = std::process::id().to_string();
    let restart_flag = if restart { "1" } else { "0" };

    // write and execute a PowerShell script to wait -> replace -> start -> cleanup
    let script_path = app
      .path()
      .resolve::<PathBuf>("update.ps1".into(), BaseDirectory::AppCache)?;
    let script_content = r#"param(
  [string]$ProcessId,
  [string]$Downloaded,
  [string]$Target,
  [string]$OldExe,
  [string]$Restart
)

try {
  while (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
    Start-Sleep -Milliseconds 200
  }

  if (Test-Path -LiteralPath $Target) { Remove-Item -LiteralPath $Target -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $OldExe) { Remove-Item -LiteralPath $OldExe -Force -ErrorAction SilentlyContinue }

  Move-Item -LiteralPath $Downloaded -Destination $Target -Force

  if ($Restart -eq '1') {
    Start-Process -FilePath $Target
  }
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
"#;

    fs::write(&script_path, script_content.as_bytes())?;
    let _ = Command::new("powershell.exe")
      .arg("-NoProfile")
      .arg("-ExecutionPolicy")
      .arg("Bypass")
      .arg("-File")
      .arg(&script_path)
      .arg(&pid)
      .arg(&downloaded_path)
      .arg(&target)
      .arg(&cur_exe)
      .arg(restart_flag)
      .creation_flags(0x08000000)
      .spawn()?;

    if restart {
      app.exit(0);
    }
    Ok(())
  } else {
    // Installed (NSIS): run the downloaded installer directly.
    if restart {
      let _ = Command::new(&downloaded_path)
        .args(["/UPDATE", "/P"])
        .creation_flags(0x08000000)
        .spawn()?;
      app.exit(0);
    }
    Ok(())
  }
}

#[cfg(target_os = "macos")]
pub async fn install_update_macos(
  app: &AppHandle,
  downloaded_filename: String,
  restart: bool,
) -> SJMCLResult<()> {
  use std::ffi::OsStr;

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let (old_version, downloaded_path, new_version) = {
    let config_state = config_binding.lock()?;
    (
      config_state.basic_info.launcher_version.clone(),
      config_state
        .download
        .cache
        .directory
        .join(&downloaded_filename),
      downloaded_filename
        .clone()
        .split('_')
        .nth(1)
        .map(|s| s.to_string())
        .unwrap_or_else(|| config_state.basic_info.launcher_version.clone()),
    )
  };
  let cur_exe = std::env::current_exe()?;

  // find app bundle folder by walking up from executable
  let app_bundle = cur_exe
    .ancestors()
    .find(|p| p.extension().and_then(OsStr::to_str) == Some("app"))
    .ok_or_else(|| SJMCLError("Not inside .app bundle".to_string()))?
    .to_path_buf();
  let app_dir = app_bundle
    .parent()
    .ok_or_else(|| SJMCLError("No parent dir for .app".to_string()))?
    .to_path_buf();
  let old_name = app_bundle
    .file_name()
    .and_then(|s| s.to_str())
    .ok_or_else(|| SJMCLError("Invalid .app name".to_string()))?
    .to_string();

  let target_name = build_local_new_filename(&old_name, &old_version, &new_version);
  let target_app = app_dir.join(target_name);
  let pid = std::process::id().to_string();
  let restart_flag = if restart { "1" } else { "0" };

  // write and execute a bash script to wait -> replace -> start -> cleanup
  let script_path = app
    .path()
    .resolve::<PathBuf>("update.sh".to_string().into(), BaseDirectory::AppCache)?;

  let script_content = r#"#!/bin/bash
set -e
PID="$1"
DOWNLOADED="$2"
TARGET_APP="$3"
OLD_APP="$4"
RESTART="$5"

# wait until current process exits
while kill -0 $PID 2>/dev/null; do sleep 0.2; done

TMPDIR="$(mktemp -d)"
tar -xzf "$DOWNLOADED" -C "$TMPDIR"
NEW_APP="$(find "$TMPDIR" -maxdepth 1 -name "*.app" | head -n 1)"
if [ -z "$NEW_APP" ]; then
  echo "No .app found in archive" >&2
  exit 1
fi

rm -rf "$TARGET_APP" || true
rm -rf "$OLD_APP" || true
mv "$NEW_APP" "$TARGET_APP"

if [ "$RESTART" = "1" ]; then
  open -a "$TARGET_APP"
fi

rm -rf "$TMPDIR" || true
"#;

  fs::write(&script_path, script_content.as_bytes())?;
  let _ = Command::new("chmod").arg("+x").arg(&script_path).status();
  let _ = Command::new("bash")
    .arg(&script_path)
    .arg(&pid)
    .arg(&downloaded_path)
    .arg(&target_app)
    .arg(&app_bundle)
    .arg(restart_flag)
    .spawn()?;

  if restart {
    app.exit(0);
  }
  Ok(())
}

// Linux portable builds ship as an AppImage-like executable, so the update is
// installed by marking the downloaded file executable and launching it.
#[cfg(target_os = "linux")]
pub async fn install_update_linux(
  app: &AppHandle,
  downloaded_filename: String,
  restart: bool,
) -> SJMCLResult<()> {
  use std::os::unix::fs::PermissionsExt;
  use tauri_plugin_opener::OpenerExt;

  let downloaded_path = {
    let config_binding = app.state::<Mutex<LauncherConfig>>();
    config_binding
      .lock()?
      .download
      .cache
      .directory
      .join(&downloaded_filename)
  };

  if let Ok(metadata) = fs::metadata(&downloaded_path) {
    let mut permissions = metadata.permissions();
    permissions.set_mode(permissions.mode() | 0o111);
    let _ = fs::set_permissions(&downloaded_path, permissions);
  }

  if restart {
    app
      .opener()
      .open_path(downloaded_path.to_string_lossy().to_string(), None::<&str>)?;
    app.exit(0);
  }
  Ok(())
}
