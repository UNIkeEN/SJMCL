use std::{
  path::PathBuf,
  time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;
use tauri::{path::BaseDirectory, AppHandle};
use tauri_plugin_log::{Target, TargetKind, TimezoneStrategy};
use time::macros::format_description;

pub fn setup_with_app(app: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  let is_dev = cfg!(debug_assertions);
  let launching_id = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
  let folder = app
    .path()
    .resolve::<PathBuf>("LauncherLogs/".into(), BaseDirectory::AppCache)?;
  let filename = format!("launcher_log_{launching_id}");
  let mut targetkinds = vec![
    TargetKind::Webview,
    TargetKind::Folder {
      path: folder,
      file_name: Some(filename),
    },
  ];
  let level = if is_dev {
    targetkinds.push(TargetKind::Stderr);
    log::LevelFilter::Debug
  } else {
    log::LevelFilter::Info
  };

  let p = tauri_plugin_log::Builder::default()
    .clear_targets()
    .level(level)
    .targets(targetkinds.into_iter().map(Target::new));

  let time_format = format_description!("[[[year]-[month]-[day]][[[hour]:[minute]:[second]]");

  app.plugin(
    if is_dev {
      p.format(move |out, message, record| {
        let lino = record.line();
        match lino {
          // if lino is present
          Some(n) => out.finish(format_args!(
            "{}[{}:{}][{}] {}",
            TimezoneStrategy::UseLocal
              .get_now()
              .format(&time_format)
              .unwrap(),
            record.target(),
            n,
            record.level(),
            message
          )),
          // otherwise
          _ => out.finish(format_args!(
            "{}[{}][{}] {}",
            TimezoneStrategy::UseLocal
              .get_now()
              .format(&time_format)
              .unwrap(),
            record.target(),
            record.level(),
            message
          )),
        }
      })
    } else {
      // no module path logging, default strategy
      p.format(move |out, message, record| {
        out.finish(format_args!(
          "{}[{}] {}",
          TimezoneStrategy::UseLocal
            .get_now()
            .format(&time_format)
            .unwrap(),
          record.level(),
          message
        ))
      })
    }
    .build(),
  )?;
  Ok(())
}
