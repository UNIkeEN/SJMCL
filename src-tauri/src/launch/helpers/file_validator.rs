use crate::{
  error::SJMCLResult,
  instance::helpers::client_json::{DownloadsArtifact, FeaturesInfo, IsAllowed, McClientInfo},
};
use futures;
use hex;
use image::EncodableLayout;
use sha1::{Digest, Sha1};
use std::{collections::HashSet, path::PathBuf};
use tokio::io::{AsyncReadExt, BufReader};

pub fn convert_client_to_artifacts(client_info: &McClientInfo) -> Vec<DownloadsArtifact> {
  let mut artifacts = HashSet::new();
  let feature = FeaturesInfo::default();
  for library in &client_info.libraries {
    if !library.is_allowed(&feature).unwrap_or(false) {
      continue;
    }
    if let Some(ref downloads) = &library.downloads {
      if let Some(ref artifact) = &downloads.artifact {
        artifacts.insert(artifact.clone());
      }
    }
  }
  for patch in &client_info.patches {
    for library in &patch.libraries {
      if !library.is_allowed(&feature).unwrap_or(false) {
        continue;
      }
      if let Some(ref downloads) = &library.downloads {
        if let Some(ref artifact) = &downloads.artifact {
          artifacts.insert(artifact.clone());
        }
      }
    }
  }
  artifacts.into_iter().collect()
}

pub async fn validate_artifact(
  root_path: &PathBuf,
  artifacts: &DownloadsArtifact,
) -> SJMCLResult<bool> {
  let file_path = root_path.join(&artifacts.path);
  let file = if let Ok(f) = tokio::fs::File::open(&file_path).await {
    f
  } else {
    return Ok(false); // return false if file not exists
  };
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

pub async fn validate_library_files(
  library_path: &PathBuf,
  client_info: &McClientInfo,
) -> SJMCLResult<Vec<DownloadsArtifact>> {
  let artifacts = convert_client_to_artifacts(client_info);
  let tasks: Vec<_> = artifacts
    .into_iter()
    .map(|artifact| {
      let library_path_clone = library_path.clone();
      tokio::spawn(async move {
        match validate_artifact(&library_path_clone, &artifact).await {
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

pub fn get_class_paths(client_info: &McClientInfo, library_path: &PathBuf) -> Vec<String> {
  convert_client_to_artifacts(client_info)
    .into_iter()
    .map(|artifact| {
      library_path
        .join(artifact.path)
        .to_string_lossy()
        .to_string()
    })
    .collect()
}
