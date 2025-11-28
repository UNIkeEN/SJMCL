use crate::error::{SJMCLError, SJMCLResult};
use crate::utils::fs::get_files_with_regex;
use regex::Regex;
use std::fmt::Arguments;
use std::sync::LazyLock;
use std::{
  path::PathBuf,
  time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;
use tauri::{path::BaseDirectory, AppHandle};
use tauri_plugin_log::fern::FormatCallback;
use tauri_plugin_log::{Target, TargetKind, TimezoneStrategy};
use time::macros::format_description;
use tokio::fs;

static LOG_FILENAME: LazyLock<String> = LazyLock::new(|| {
  let launching_id = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap()
    .as_secs();
  format!("launcher_log_{launching_id}")
});

pub fn get_launcher_logs_folder(app: &AppHandle) -> PathBuf {
  let folder = app
    .path()
    .resolve::<PathBuf>("LauncherLogs/".into(), BaseDirectory::AppCache)
    .unwrap();
  folder
}

// the path to the current launcher log file
pub fn get_launcher_log_path(app: AppHandle) -> PathBuf {
  let folder = get_launcher_logs_folder(&app);
  PathBuf::from(format!(
    "{}/{}.log",
    folder.to_str().unwrap(),
    *LOG_FILENAME
  ))
}

pub fn setup_with_app(app: AppHandle) -> SJMCLResult<()> {
  let is_dev = cfg!(debug_assertions);
  let folder = get_launcher_logs_folder(&app);
  let mut targetkinds = vec![
    TargetKind::Webview,
    TargetKind::Folder {
      path: folder,
      file_name: Some(LOG_FILENAME.clone()),
    },
  ];
  let level = if is_dev {
    targetkinds.push(TargetKind::Stderr);
    log::LevelFilter::Debug
  } else {
    log::LevelFilter::Info
  };

  // filter out noisy debug logs
  const FILTERED_TARGETS_DEBUG: &[&str] = &["h2::", "hyper_util"];

  let p = tauri_plugin_log::Builder::default()
    .clear_targets()
    .level(level)
    .targets(targetkinds.into_iter().map(Target::new))
    .filter(|m| {
      !(m.level() == log::Level::Debug
        && FILTERED_TARGETS_DEBUG
          .iter()
          .any(|p| m.target().starts_with(p)))
    });

  let time_format = format_description!("[[[year]-[month]-[day]][[[hour]:[minute]:[second]]");

  let formatter = move |out: FormatCallback, message: &Arguments, record: &log::Record| {
    let now = TimezoneStrategy::UseLocal
      .get_now()
      .format(&time_format)
      .unwrap();

    if is_dev {
      // if line number is present
      if let Some(line) = record.line() {
        out.finish(format_args!(
          "{}[{}:{}][{}] {}",
          now,
          record.target(),
          line,
          record.level(),
          message
        ));
      } else {
        out.finish(format_args!(
          "{}[{}][{}] {}",
          now,
          record.target(),
          record.level(),
          message
        ));
      }
    } else {
      // no module path logging, default strategy
      out.finish(format_args!("{}[{}] {}", now, record.level(), message));
    }
  };

  app
    .plugin(p.format(formatter).build())
    .map_err(|e| SJMCLError(format!("Failed to setup log plugin: {}", e)))?;

  Ok(())
}

pub async fn purge_old_launcher_logs(app: AppHandle, days: u64) -> SJMCLResult<()> {
  let folder = get_launcher_logs_folder(&app);
  if !folder.exists() {
    return Ok(());
  }

  let cutoff = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs()
    .saturating_sub(days.saturating_mul(24 * 60 * 60));

  let re = Regex::new(r"^launcher_log_(\d+)\.log$")
    .map_err(|e| SJMCLError(format!("Invalid regex: {e}")))?;
  let files = get_files_with_regex(&folder, &re)?;

  for path in files {
    let Some(name) = path.file_name().and_then(|s| s.to_str()) else {
      continue;
    };
    let ts = re
      .captures(name)
      .and_then(|c| c.get(1))
      .and_then(|m| m.as_str().parse::<u64>().ok());
    if ts.is_some_and(|t| t < cutoff) {
      if let Err(e) = fs::remove_file(&path).await {
        log::warn!("Failed to remove {}: {}", path.display(), e);
      }
    }
  }

  Ok(())
}
