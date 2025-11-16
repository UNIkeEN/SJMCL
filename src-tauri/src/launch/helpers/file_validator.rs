use crate::error::SJMCLResult;
use crate::instance::helpers::asset_index::load_asset_index;
use crate::instance::helpers::client_json::{
  DownloadsArtifact, FeaturesInfo, IsAllowed, LibrariesValue, McClientInfo,
};
use crate::instance::models::misc::InstanceError;
use crate::launch::helpers::misc::get_natives_string;
use crate::launch::models::LaunchError;
use crate::resource::helpers::misc::{convert_url_to_target_source, get_download_api};
use crate::resource::models::{ResourceType, SourceType};
use crate::tasks::download::DownloadParam;
use crate::tasks::PTaskParam;
use crate::utils::fs::validate_sha1;
use futures::stream::{self, StreamExt};
use semver::Version;
use std::collections::{HashMap, HashSet};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use sysinfo::{CpuRefreshKind, RefreshKind, System};
use tauri::AppHandle;
use tokio::fs;
use url::Url;
use zip::ZipArchive;

#[derive(Debug, Hash, Eq, PartialEq)]
struct LibraryKey {
  path: String,
  pack_name: String,
  classifier: Option<String>,
  extension: String,
}

pub struct LibraryParts {
  pub path: String,
  pub pack_name: String,
  pub pack_version: String,
  pub classifier: Option<String>,
  pub extension: String,
}

fn get_concurrent_hash_checks() -> usize {
  static CONCURRENT_LIMIT: OnceLock<usize> = OnceLock::new();

  *CONCURRENT_LIMIT.get_or_init(|| {
    let mut sys =
      System::new_with_specifics(RefreshKind::nothing().with_cpu(CpuRefreshKind::everything()));
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_cpu_usage();
    let cpu_count = sys.cpus().len();
    (cpu_count * 3).max(8).min(32)
  })
}

fn parse_sem_version(version: &str) -> Version {
  Version::parse(version).unwrap_or_else(|_| {
    let mut parts = version.split('.').collect::<Vec<_>>();
    while parts.len() < 3 {
      parts.push("0");
    }
    Version::parse(&parts[..3].join(".")).unwrap_or_else(|_| Version::new(0, 1, 0))
  })
}

pub fn parse_library_name(name: &str, native: Option<String>) -> SJMCLResult<LibraryParts> {
  let parts: Vec<&str> = name.split('@').collect();
  let file_ext = parts
    .get(1)
    .map(|s| s.to_string())
    .unwrap_or_else(|| "jar".to_string());

  let mut name_split: Vec<String> = parts[0].split(':').map(|s| s.to_string()).collect();

  if name_split.len() < 3 {
    return Err(InstanceError::InvalidSourcePath.into());
  }

  if let Some(native) = native {
    name_split.push(native);
  }

  let path = name_split[0].replace('.', "/");
  let pack_name = name_split[1].clone();
  let pack_version = name_split[2].clone();
  let classifier = name_split.get(3).cloned();

  Ok(LibraryParts {
    path,
    pack_name,
    pack_version,
    classifier,
    extension: file_ext,
  })
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

async fn validate_file_with_hash(
  file_path: PathBuf,
  expected_hash: String,
  download_url: Url,
  check_hash: bool,
) -> SJMCLResult<Option<PTaskParam>> {
  let exists = fs::try_exists(&file_path).await?;

  let needs_download = !exists || {
    if check_hash {
      let hash = expected_hash.clone();
      let path = file_path.clone();
      let is_valid = tokio::task::spawn_blocking(move || validate_sha1(path, hash).is_ok()).await?;
      !is_valid
    } else {
      false
    }
  };

  if needs_download {
    return Ok(Some(PTaskParam::Download(DownloadParam {
      src: download_url,
      dest: file_path,
      filename: None,
      sha1: Some(expected_hash),
    })));
  }

  Ok(None)
}

async fn validate_files_concurrently<T, F, Fut>(
  items: impl Iterator<Item = T>,
  check_hash: bool,
  processor: F,
) -> SJMCLResult<Vec<PTaskParam>>
where
  F: Fn(T, bool) -> Fut,
  Fut: std::future::Future<Output = SJMCLResult<Option<PTaskParam>>>,
{
  let concurrent_limit = get_concurrent_hash_checks();

  let results: Vec<SJMCLResult<Option<PTaskParam>>> = stream::iter(items)
    .map(|item| processor(item, check_hash))
    .buffer_unordered(concurrent_limit)
    .collect()
    .await;

  let mut params = Vec::new();
  for r in results {
    if let Some(p) = r? {
      params.push(p);
    }
  }
  Ok(params)
}

pub fn get_nonnative_library_artifacts(client_info: &McClientInfo) -> Vec<DownloadsArtifact> {
  let mut artifacts = HashSet::new();
  let feature = FeaturesInfo::default();

  for library in &client_info.libraries {
    if !library.is_allowed(&feature).unwrap_or(false) || library.natives.is_some() {
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

pub fn get_nonnative_library_paths(
  client_info: &McClientInfo,
  library_path: &Path,
) -> SJMCLResult<Vec<PathBuf>> {
  let mut libraries = Vec::new();
  let feature = FeaturesInfo::default();

  for library in &client_info.libraries {
    if library.is_allowed(&feature).unwrap_or(false) && library.natives.is_none() {
      libraries.push(library.clone());
    }
  }

  libraries = merge_library_lists(&libraries, &[]);

  libraries
    .iter()
    .map(|lib| Ok(library_path.join(convert_library_name_to_path(&lib.name, None)?)))
    .collect()
}

pub fn get_native_library_paths(
  client_info: &McClientInfo,
  library_path: &Path,
) -> SJMCLResult<Vec<PathBuf>> {
  let mut result = Vec::new();
  let feature = FeaturesInfo::default();
  for library in &client_info.libraries {
    if !library.is_allowed(&feature).unwrap_or(false) || library.natives.is_none() {
      continue;
    }
    let native_str = if let Some(native_fn) = Some(&get_natives_string) {
      library.natives.as_ref().and_then(native_fn)
    } else {
      None
    };

    let path = convert_library_name_to_path(&library.name, native_str)?;
    result.push(library_path.join(path));
  }
  Ok(result)
}

// merge two vectors of libraries, remove duplicates by name, keep the one with the highest version. also remove libraries with invalid names
pub fn merge_library_lists(
  libraries_a: &[LibrariesValue],
  libraries_b: &[LibrariesValue],
) -> Vec<LibrariesValue> {
  let mut library_map: HashMap<LibraryKey, LibrariesValue> = HashMap::new();

  for library in libraries_a.iter().chain(libraries_b.iter()) {
    if let Ok(library_parts) = parse_library_name(&library.name, None) {
      let key = LibraryKey {
        path: library_parts.path,
        pack_name: library_parts.pack_name,
        classifier: library_parts.classifier,
        extension: library_parts.extension,
      };

      let new_version = &library_parts.pack_version;

      if let Some(existing_library) = library_map.get(&key) {
        let existing_version = parse_library_name(&existing_library.name, None)
          .map(|parts| parts.pack_version)
          .unwrap_or("0.1.0".to_string());

        if parse_sem_version(new_version) > parse_sem_version(&existing_version) {
          library_map.insert(key, library.clone());
        }
      } else {
        library_map.insert(key, library.clone());
      }
    }
  }

  library_map.into_values().collect()
}

pub async fn get_invalid_library_files(
  source: SourceType,
  library_path: &Path,
  client_info: &McClientInfo,
  check_hash: bool,
) -> SJMCLResult<Vec<PTaskParam>> {
  let mut artifacts = Vec::new();
  artifacts.extend(get_native_library_artifacts(client_info));
  artifacts.extend(get_nonnative_library_artifacts(client_info));

  let library_path = library_path.to_path_buf();
  let source = source.clone();

  validate_files_concurrently(
    artifacts.into_iter(),
    check_hash,
    move |artifact, check_hash| {
      let source = source.clone();
      let library_path = library_path.clone();

      async move {
        if artifact.url.is_empty() {
          return Err(LaunchError::GameFilesIncomplete.into());
        }

        let file_path = library_path.join(&artifact.path);
        let url = Url::parse(&artifact.url)?;

        let download_url = convert_url_to_target_source(
          &url,
          &[
            ResourceType::Libraries,
            ResourceType::FabricMaven,
            ResourceType::ForgeMaven,
            ResourceType::ForgeMavenNew,
            ResourceType::NeoforgeMaven,
          ],
          &source,
        )?;

        validate_file_with_hash(file_path, artifact.sha1, download_url, check_hash).await
      }
    },
  )
  .await
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

  let results: Vec<_> = stream::iter(native_libraries)
    .map(|library_path| {
      let patches_dir_clone = natives_dir.clone();

      async move {
        let file = Cursor::new(fs::read(&library_path).await?);
        let mut jar = ZipArchive::new(file)?;
        jar.extract(&patches_dir_clone)?;
        Ok::<_, crate::error::SJMCLError>(())
      }
    })
    .buffer_unordered(4)
    .collect::<Vec<_>>()
    .await;

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
) -> SJMCLResult<Vec<PTaskParam>> {
  let assets_download_api = get_download_api(source, ResourceType::Assets)?;
  let asset_index_path = asset_path.join(format!("indexes/{}.json", client_info.asset_index.id));
  let asset_index = load_asset_index(app, &asset_index_path, &client_info.asset_index.url).await?;

  let base_path = asset_path.to_path_buf();

  validate_files_concurrently(
    asset_index.objects.into_values(),
    check_hash,
    move |item, check_hash| {
      let assets_download_api = assets_download_api.clone();
      let base_path = base_path.clone();

      async move {
        let path_in_repo = format!("{}/{}", &item.hash[..2], item.hash);
        let dest = base_path.join(format!("objects/{}", path_in_repo));
        let download_url = assets_download_api
          .join(&path_in_repo)
          .map_err(crate::error::SJMCLError::from)?;

        validate_file_with_hash(dest, item.hash, download_url, check_hash).await
      }
    },
  )
  .await
}
