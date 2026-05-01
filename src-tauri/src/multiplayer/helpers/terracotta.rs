use crate::error::SJMCLResult;
use crate::launcher_config::models::LauncherConfig;
use crate::multiplayer::models::MultiplayerError;
use crate::resource::helpers::misc::{get_download_api, get_source_priority_list};
use crate::resource::models::ResourceType;
use crate::tasks::{download::DownloadParam, PTaskParam};
use flate2::read::GzDecoder;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::sync::Mutex;
use tar::Archive;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

pub async fn build_download_param(app: &AppHandle) -> SJMCLResult<Vec<PTaskParam>> {
  let config = app.state::<Mutex<LauncherConfig>>().lock()?.clone();
  let client = app.state::<reqwest::Client>();

  let mut param = Vec::<PTaskParam>::new();

  let platform = match (&*config.basic_info.os_type, &*config.basic_info.arch) {
    ("windows", "aarch64") => "windows-arm64",
    ("windows", _) => "windows-x86_64",
    ("macos", "aarch64") => "macos-arm64",
    ("macos", _) => "macos-x86_64",
    ("linux", "aarch64") => "linux-arm64",
    ("linux", "riscv64") => "linux-riscv64",
    _ => "linux-x86_64",
  };
  let priority_list = get_source_priority_list(&config);

  for source_type in priority_list.iter() {
    let api_url = get_download_api(*source_type, ResourceType::Terracotta)?;
    match client.get(api_url.clone()).send().await {
      Ok(_) => {
        let filename = format!("terracotta-0.4.2-{platform}-pkg.tar.gz");
        let url = api_url.join(&format!("download/v0.4.2/{filename}"))?;
        let path = app
          .path()
          .resolve("terracotta", BaseDirectory::AppData)?
          .join(filename);
        log::debug!("{}, {}", url, path.to_str().unwrap());
        param.push(PTaskParam::Download(DownloadParam {
          src: url,
          dest: path,
          filename: None,
          sha1: None,
        }));
        break;
      }
      Err(_) => continue,
    }
  }

  Ok(param)
}

pub async fn decompress(app: &AppHandle) -> SJMCLResult<()> {
  let dir = app.path().resolve("terracotta", BaseDirectory::AppData)?;
  for entry in fs::read_dir(&dir)? {
    let entry = entry?;
    let path = entry.path();

    if path.extension().and_then(|s| s.to_str()) == Some("gz") {
      log::info!("Found compressed file: {:?}", path);
      let file = fs::File::open(&path)?;
      let decompressor = GzDecoder::new(file);
      let mut archive = Archive::new(decompressor);
      archive.unpack(dir).map_err(|e| {
        log::error!("Failed to unpack archive: {}", e);
        e
      })?;
      fs::remove_file(path)?;

      #[cfg(unix)]
      {
        for entry in fs::read_dir(&dir)? {
          let entry = entry?;
          let path = entry.path();
          if path.is_file() {
            let ext = path.extension().and_then(|s| s.to_str());
            if ext != Some("gz") && ext != Some("pkg") {
              fs::set_permissions(&path, PermissionsExt::from_mode(0o755))?;
            }
          }
        }
      }

      return Ok(());
    }
  }
  Err(MultiplayerError::CompressedFileNotFound.into())
}
