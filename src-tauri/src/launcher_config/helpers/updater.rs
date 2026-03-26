use crate::error::{SJMCLError, SJMCLResult};
use crate::launcher_config::models::{LauncherConfig, LauncherConfigError};
use crate::tasks::commands::schedule_progressive_task_group;
use crate::tasks::download::DownloadParam;
use crate::tasks::PTaskParam;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

type SourceTuple = (&'static str, &'static str, fn(&str, &str) -> String);
const SOURCES: [SourceTuple; 2] = [
  (
    "https://mc.sjtu.cn/api-sjmcl/releases/latest",
    "version",
    |_, fname| format!("https://mc.sjtu.cn/sjmcl/releases/{}", fname),
  ),
  (
    "https://api.github.com/repos/UNIkeEN/SJMCL/releases/latest",
    "tag_name",
    |ver, fname| {
      format!(
        "https://github.com/UNIkeEN/SJMCL/releases/download/v{}/{}",
        ver, fname
      )
    },
  ),
];

// Generate the new version filename on remote origin according to the current os, arch and is_portable
fn build_resource_filename(ver: &str, os: &str, arch: &str, is_portable: bool) -> String {
  let arch = if arch == "x86" { "i686" } else { arch };
  let suffix = match os {
    "windows" => {
      if is_portable {
        "_portable.exe"
      } else {
        "_setup.exe"
      }
    }
    "linux" => ".AppImage",
    "macos" => ".app.tar.gz",
    _ => "",
  };
  format!("SJMCL_{}_{}_{}{}", ver, os, arch, suffix)
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
  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let (os, arch, is_portable, is_china_mainland_ip) = {
    let config_state = config_binding.lock()?;
    (
      config_state.basic_info.os_type.clone(),
      config_state.basic_info.arch.clone(),
      config_state.basic_info.is_portable,
      config_state.basic_info.is_china_mainland_ip,
    )
  };
  let client = app.state::<reqwest::Client>();

  let mut sources = SOURCES;
  // If not in China (mainland), firstly try GitHub.
  if !is_china_mainland_ip {
    sources.reverse();
  }

  for (endpoint, field, _) in sources {
    if let Ok(resp) = client.get(endpoint).send().await {
      if let Ok(j) = resp.json::<Value>().await {
        if let Some(mut ver) = j.get(field).and_then(|v| v.as_str()).map(|s| s.to_string()) {
          if ver.starts_with('v') {
            ver.remove(0);
          }
          let fname = build_resource_filename(&ver, os.as_str(), arch.as_str(), is_portable);

          let release_notes = j
            .get("body")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
          let published_at = j
            .get("published_at")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

          return Ok(Some((ver, fname, release_notes, published_at)));
        }
      }
    }
  }

  Err(LauncherConfigError::FetchError.into())
}

pub async fn download_target_version(
  app: &AppHandle,
  version: String,
  fname: String,
) -> SJMCLResult<()> {
  let config_binding = app.state::<Mutex<LauncherConfig>>();
  let (download_cache_dir, is_china_mainland_ip) = {
    let config_state = config_binding.lock()?;
    (
      config_state.download.cache.directory.clone(),
      config_state.basic_info.is_china_mainland_ip,
    )
  };

  let client = app.state::<reqwest::Client>();

  let mut sources = SOURCES;
  if !is_china_mainland_ip {
    sources.reverse();
  }

  for (endpoint, _, mk_url) in sources {
    if let Ok(resp) = client.get(endpoint).send().await {
      if resp.status().is_success() {
        let url = mk_url(&version, &fname);

        schedule_progressive_task_group(
          app.clone(),
          format!("launcher-update?{}", fname),
          vec![PTaskParam::Download(DownloadParam {
            src: url::Url::parse(&url).map_err(|_| LauncherConfigError::FetchError)?,
            dest: download_cache_dir.join(&fname),
            filename: Some(fname),
            sha1: None,
          })],
          true,
        )
        .await?;

        return Ok(());
      }
    }
  }

  Err(LauncherConfigError::FetchError.into())
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
      .arg(&cur_exe.clone())
      .arg(restart_flag)
      .creation_flags(0x08000000)
      .spawn()?;

    if restart {
      app.exit(0);
    }
    Ok(())
  } else {
    // MSI: run installer in passive mode.
    if restart {
      let _ = Command::new("msiexec.exe")
        .args(["/i", &downloaded_path.to_string_lossy(), "/passive"])
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
