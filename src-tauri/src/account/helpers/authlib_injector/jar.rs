use super::constants::AUTHLIB_INJECTOR_JAR_NAME;
use crate::account::models::AccountError;
use crate::error::SJMCLResult;
use crate::launcher_config::models::LauncherConfig;
use crate::resource::helpers::misc::{get_download_api, get_source_priority_list};
use crate::resource::models::{ResourceType, SourceType};
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use url::Url;

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
pub struct AuthlibInjectorMeta {
  pub version: String,
  pub download_url: String,
}

pub fn get_jar_path(app: &AppHandle) -> SJMCLResult<PathBuf> {
  Ok(
    app
      .path()
      .resolve::<PathBuf>(AUTHLIB_INJECTOR_JAR_NAME.into(), BaseDirectory::AppData)?,
  )
}

async fn get_latest_meta(
  app: &AppHandle,
  priority_list: &[SourceType],
) -> SJMCLResult<AuthlibInjectorMeta> {
  let client = app.state::<reqwest::Client>();

  for source in priority_list.iter() {
    let url = get_download_api(*source, ResourceType::AuthlibInjector)?;
    let response = client
      .get(url.join("artifact/latest.json")?)
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if response.status().is_success() {
      return Ok(
        response
          .json::<AuthlibInjectorMeta>()
          .await
          .map_err(|_| AccountError::ParseError)?,
      );
    }
  }

  Err(AccountError::NoDownloadApi.into())
}

fn get_local_version(app: &AppHandle) -> SJMCLResult<String> {
  let jar_path = get_jar_path(app)?;
  if !jar_path.exists() {
    return Err(AccountError::NotFound.into());
  }

  let file = std::fs::File::open(jar_path)?;

  let mut archive = zip::ZipArchive::new(file)?;
  let mut file = archive.by_name("META-INF/MANIFEST.MF")?;
  let mut content = String::new();

  file.read_to_string(&mut content)?;

  let version_line = content
    .lines()
    .find(|line| line.starts_with("Implementation-Version:"))
    .ok_or(AccountError::ParseError)?;

  let version = version_line
    .split(':')
    .nth(1)
    .ok_or(AccountError::ParseError)?
    .trim()
    .to_string();

  Ok(version)
}

async fn download(app: &AppHandle, url: Url) -> SJMCLResult<()> {
  let client = app.state::<reqwest::Client>();
  let jar_path = get_jar_path(app)?;

  let response = client
    .get(url)
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  if response.status().is_success() {
    let bytes = response
      .bytes()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    std::fs::write(jar_path, bytes).map_err(|_| AccountError::SaveError)?;
    Ok(())
  } else {
    Err(AccountError::NetworkError.into())
  }
}

pub async fn check_authlib_jar(app: &AppHandle) -> SJMCLResult<()> {
  let latest_meta = {
    let config_state = app.state::<Mutex<LauncherConfig>>();
    let launcher_config = config_state.lock()?.clone();
    get_latest_meta(app, &get_source_priority_list(&launcher_config)).await?
  };

  if let Ok(local_version) = get_local_version(app) {
    if local_version == latest_meta.version {
      println!("Authlib-Injector up to date: {}", local_version);
      return Ok(());
    }
  }

  println!(
    "Authlib-Injector new version downloading: {}",
    latest_meta.version
  );
  download(app, Url::parse(&latest_meta.download_url)?).await?;

  Ok(())
}
