use crate::{
  error::SJMCLResult,
  instance::{
    helpers::{
      asset_index::load_asset_index,
      client_json::{DownloadsArtifact, FeaturesInfo, IsAllowed, McClientInfo},
    },
    models::misc::InstanceError,
  },
  launch::models::LaunchError,
  resource::{
    helpers::misc::{convert_url_to_target_source, get_download_api},
    models::{ResourceType, SourceType},
  },
  tasks::{download::DownloadParam, RuntimeTaskParam},
  utils::fs::validate_sha1,
};
use futures::future::join_all;
use std::collections::HashSet;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tokio::fs;
use zip::ZipArchive;

use super::misc::get_natives_string;

pub fn get_nonnative_library_artifacts(client_info: &McClientInfo) -> Vec<DownloadsArtifact> {
  let mut artifacts = HashSet::new();
  let feature = FeaturesInfo::default();
  for library in &client_info.libraries {
    if !library.is_allowed(&feature).unwrap_or(false) {
      continue;
    }
    if library.natives.is_some() {
      continue;
    }
    if let Some(ref downloads) = &library.downloads {
      if let Some(ref artifact) = &downloads.artifact {
        artifacts.insert(artifact.clone());
      }
    }
  }
  artifacts.into_iter().collect()
}

pub fn get_native_library_artifacts(client_info: &McClientInfo) -> Vec<DownloadsArtifact> {
  let mut artifacts = HashSet::new();
  let feature = FeaturesInfo::default();

  for library in &client_info.libraries {
    if !library.is_allowed(&feature).unwrap_or(false) {
      continue;
    }
    if let Some(natives) = &library.natives {
      if let Some(native) = get_natives_string(natives) {
        if let Some(ref downloads) = &library.downloads {
          if let Some(ref classifiers) = &downloads.classifiers {
            if let Some(artifact) = classifiers.get(&native) {
              artifacts.insert(artifact.clone());
            }
          }
        }
      } else {
        println!("natives is None");
      }
    }
  }
  artifacts.into_iter().collect()
}

pub async fn get_invalid_library_files(
  source: SourceType,
  library_path: &Path,
  client_info: &McClientInfo,
  check_hash: bool,
) -> SJMCLResult<Vec<RuntimeTaskParam>> {
  let mut artifacts = Vec::new();
  artifacts.extend(get_native_library_artifacts(client_info));
  artifacts.extend(get_nonnative_library_artifacts(client_info));

  let futs = artifacts.into_iter().map(move |artifact| {
    let source = source.clone();
    async move {
      let file_path = library_path.join(&artifact.path);
      if file_path.exists()
        && (!check_hash || validate_sha1(file_path.clone(), artifact.sha1.clone()).is_ok())
      {
        return Ok(None);
      } else if artifact.url.is_empty() {
        return Err(LaunchError::GameFilesIncomplete.into());
      } else {
        let src = convert_url_to_target_source(
          &url::Url::parse(&artifact.url)?,
          &[
            ResourceType::Libraries,
            ResourceType::FabricMaven,
            ResourceType::ForgeMaven,
            ResourceType::ForgeMavenNew,
            ResourceType::NeoforgeMaven,
          ],
          &source,
        )?;
        Ok(Some(RuntimeTaskParam::Download(DownloadParam {
          src,
          dest: file_path,
          filename: None,
          sha1: Some(artifact.sha1.clone()),
        })))
      }
    }
  });

  let results: Vec<SJMCLResult<Option<RuntimeTaskParam>>> = join_all(futs).await;

  let mut params = Vec::new();
  for r in results {
    if let Some(p) = r? {
      params.push(p);
    }
  }

  Ok(params)
}

pub struct LibraryParts {
  pub path: String,
  pub pack_name: String,
  pub pack_version: String,
  pub classifier: Option<String>,
  pub extension: String,
}

pub fn parse_library_name(name: &str, native: Option<String>) -> SJMCLResult<LibraryParts> {
  let parts: Vec<&str> = name.split('@').collect();
  let file_ext = if parts.len() > 1 {
    parts[1].to_string()
  } else {
    "jar".to_string()
  };
  let mut name_split: Vec<String> = parts[0].split(':').map(|s| s.to_string()).collect();
  if name_split.len() < 3 {
    Err(InstanceError::InvalidSourcePath.into())
  } else {
    if let Some(native) = native {
      name_split.push(native);
    }
    let pack_name = name_split[1].clone();
    let pack_version = name_split[2].clone();
    let classifier = if name_split.len() > 3 {
      Some(name_split[3].clone())
    } else {
      None
    };
    let path = name_split[0].replace('.', "/");
    Ok(LibraryParts {
      path,
      pack_name,
      pack_version,
      classifier,
      extension: file_ext,
    })
  }
}

pub fn convert_library_name_to_path(name: &str, native: Option<String>) -> SJMCLResult<String> {
  let LibraryParts {
    path,
    pack_name,
    pack_version,
    classifier,
    extension: file_ext,
  } = parse_library_name(name, native)?;

  let file_name = [
    pack_name.clone(),
    pack_version.clone(),
    classifier.unwrap_or_default(),
  ]
  .iter()
  .filter(|s| !s.is_empty())
  .map(|s| s.as_str())
  .collect::<Vec<&str>>()
  .join("-")
    + "."
    + &file_ext;
  Ok(format!("{path}/{pack_name}/{pack_version}/{file_name}"))
}

pub fn get_nonnative_library_paths(
  client_info: &McClientInfo,
  library_path: &Path,
) -> SJMCLResult<Vec<PathBuf>> {
  let mut result = Vec::new();
  let feature = FeaturesInfo::default();
  for library in &client_info.libraries {
    if !library.is_allowed(&feature).unwrap_or(false) {
      continue;
    }
    if library.natives.is_some() {
      continue;
    }
    result.push(library_path.join(convert_library_name_to_path(&library.name, None)?));
  }
  Ok(result)
}

pub fn get_native_library_paths(
  client_info: &McClientInfo,
  library_path: &Path,
) -> SJMCLResult<Vec<PathBuf>> {
  let mut result = Vec::new();
  let feature = FeaturesInfo::default();
  for library in &client_info.libraries {
    if !library.is_allowed(&feature).unwrap_or(false) {
      continue;
    }
    if let Some(natives) = &library.natives {
      if let Some(native) = get_natives_string(natives) {
        let path = convert_library_name_to_path(&library.name, Some(native))?;
        result.push(library_path.join(path));
      } else {
        println!("natives is None");
      }
    }
  }
  Ok(result)
}

pub async fn extract_native_libraries(
  client_info: &McClientInfo,
  library_path: &Path,
  natives_dir: &PathBuf,
) -> SJMCLResult<()> {
  if !natives_dir.exists() {
    fs::create_dir(natives_dir).await?;
  }
  let native_libraries = get_native_library_paths(client_info, library_path)?;
  let tasks: Vec<tokio::task::JoinHandle<SJMCLResult<()>>> = native_libraries
    .into_iter()
    .map(|library_path| {
      let patches_dir_clone = natives_dir.clone();

      tokio::spawn(async move {
        let file = Cursor::new(fs::read(library_path).await?);
        let mut jar = ZipArchive::new(file)?;
        jar.extract(&patches_dir_clone)?;
        Ok(())
      })
    })
    .collect();

  let results = futures::future::join_all(tasks).await;

  for result in results {
    if let Err(e) = result {
      println!("Error handling artifact: {:?}", e);
      return Err(crate::error::SJMCLError::from(e)); // Assuming e is of type SJMCLResult
    }
  }

  Ok(())
}

pub async fn get_invalid_assets(
  app: &AppHandle,
  client_info: &McClientInfo,
  source: SourceType,
  asset_path: &Path,
  check_hash: bool,
) -> SJMCLResult<Vec<RuntimeTaskParam>> {
  let assets_download_api = get_download_api(source, ResourceType::Assets)?;

  let asset_index_path = asset_path.join(format!("indexes/{}.json", client_info.asset_index.id));
  let asset_index = load_asset_index(app, &asset_index_path, &client_info.asset_index.url).await?;

  Ok(
    asset_index
      .objects
      .iter()
      .filter_map(|(_, item)| {
        let path = format!("{}/{}", &item.hash[..2], item.hash.clone());
        let dest = asset_path.join(format!("objects/{}", path));

        if dest.exists() && (!check_hash || validate_sha1(dest.clone(), item.hash.clone()).is_ok())
        {
          None
        } else {
          Some(RuntimeTaskParam::Download(DownloadParam {
            src: assets_download_api.join(&path).ok()?,
            dest,
            filename: None,
            sha1: Some(item.hash.clone()),
          }))
        }
      })
      .collect::<Vec<_>>(),
  )
}
