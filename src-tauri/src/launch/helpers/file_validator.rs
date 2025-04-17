use crate::{
  error::SJMCLResult,
  instance::{
    helpers::client_json::{DownloadsArtifact, FeaturesInfo, IsAllowed, McClientInfo},
    models::misc::InstanceError,
  },
};
use futures;
use hex;
use image::EncodableLayout;
use sha1::{Digest, Sha1};
use std::collections::HashSet;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use tokio::{
  fs,
  io::{AsyncReadExt, BufReader},
};
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

pub async fn validate_artifact(
  root_path: &Path,
  artifacts: &DownloadsArtifact,
  check_hash: bool,
) -> SJMCLResult<bool> {
  let file_path = root_path.join(&artifacts.path);

  match tokio::fs::File::open(&file_path).await {
    Ok(file) => {
      if !check_hash {
        return Ok(true);
      }

      // validate hash
      let mut reader = BufReader::new(file);
      let mut hasher = Sha1::new();
      let mut buffer = [0; 4096];
      loop {
        let bytes_read = reader.read(&mut buffer).await?;
        if bytes_read != 0 {
          hasher.update(&buffer[..bytes_read]);
        } else {
          break;
        }
      }
      let sha1 = hasher.finalize();
      let result = sha1.as_bytes();
      let expected = hex::decode(&artifacts.sha1)?;
      Ok(result == expected)
    }

    Err(_) => Ok(false), // not exist
  }
}

pub async fn validate_library_files(
  library_path: &Path,
  client_info: &McClientInfo,
  check_hash: bool,
) -> SJMCLResult<Vec<DownloadsArtifact>> {
  let mut artifacts = Vec::new();
  artifacts.extend(get_native_library_artifacts(client_info));
  artifacts.extend(get_nonnative_library_artifacts(client_info));
  let tasks: Vec<_> = artifacts
    .into_iter()
    .map(|artifact| {
      let library_path_clone = library_path.to_path_buf();
      tokio::spawn(async move {
        match validate_artifact(&library_path_clone, &artifact, check_hash).await {
          Ok(succ) => {
            if !succ {
              Some(artifact)
            } else {
              None
            }
          }
          Err(_) => Some(artifact),
        }
      })
    })
    .collect();

  let results = futures::future::join_all(tasks).await;
  let mut bad_artifacts = Vec::new();
  for result in results {
    match result {
      Ok(Some(artifact)) => bad_artifacts.push(artifact),
      Ok(None) => continue,
      Err(e) => {
        println!("{:?}", e);
        continue;
      }
    }
  }
  Ok(bad_artifacts)
}

fn convert_library_name_to_path(name: &String, native: Option<String>) -> SJMCLResult<String> {
  let mut name_split: Vec<String> = name.split(":").map(|s| s.to_string()).collect();
  if name_split.len() < 3 {
    println!("name = {}", name);
    Err(InstanceError::ClientJsonParseError.into())
  } else {
    if let Some(n) = native {
      name_split.push(n);
    }
    let pack_name = &name_split[1];
    let pack_version = &name_split[2];
    let jar_file_name = name_split[1..].join("-") + ".jar";
    let lib_path = name_split[0].replace('.', "/");
    Ok(format!(
      "{}/{}/{}/{}",
      lib_path, pack_name, pack_version, jar_file_name
    ))
  }
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
  println!("native lib: {:?}", native_libraries);
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
