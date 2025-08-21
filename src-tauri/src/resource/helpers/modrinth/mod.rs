pub mod misc;

use crate::error::SJMCLResult;
use crate::resource::models::{
  OtherResourceFileInfo, OtherResourceInfo, OtherResourceSearchQuery, OtherResourceSearchRes,
  OtherResourceVersionPack, OtherResourceVersionPackQuery, ResourceError,
};
use crate::tasks::download::DownloadParam;
use hex;
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use url::Url;

use misc::{
  get_modrinth_api, make_modrinth_request, map_modrinth_file_to_version_pack, ModrinthApiEndpoint,
  ModrinthProject, ModrinthRequestType, ModrinthSearchRes, ModrinthVersionPack,
};

const ALL_FILTER: &str = "All";

pub async fn fetch_resource_list_by_name_modrinth(
  app: &AppHandle,
  query: &OtherResourceSearchQuery,
) -> SJMCLResult<OtherResourceSearchRes> {
  let url = get_modrinth_api(ModrinthApiEndpoint::Search, None)?;

  let OtherResourceSearchQuery {
    resource_type,
    search_query,
    game_version,
    selected_tag,
    sort_by,
    page,
    page_size,
  } = query;

  let mut facets = vec![vec![format!("project_type:{}", resource_type)]];
  if !game_version.is_empty() && game_version != ALL_FILTER {
    facets.push(vec![format!("versions:{}", game_version)]);
  }
  if !selected_tag.is_empty() && selected_tag != ALL_FILTER {
    facets.push(vec![format!("categories:{}", selected_tag)]);
  }

  let mut params = HashMap::new();
  params.insert("query".to_string(), search_query.to_string());
  params.insert(
    "facets".to_string(),
    serde_json::to_string(&facets).unwrap_or_default(),
  );
  params.insert("offset".to_string(), (page * page_size).to_string());
  params.insert("limit".to_string(), page_size.to_string());
  params.insert("index".to_string(), sort_by.to_string());

  let client = app.state::<reqwest::Client>();
  let results = make_modrinth_request::<ModrinthSearchRes, ()>(
    &client,
    &url,
    ModrinthRequestType::GetWithParams(&params),
  )
  .await?;
  Ok(results.into())
}

pub async fn fetch_resource_version_packs_modrinth(
  app: &AppHandle,
  query: &OtherResourceVersionPackQuery,
) -> SJMCLResult<Vec<OtherResourceVersionPack>> {
  let OtherResourceVersionPackQuery {
    resource_id,
    mod_loader,
    game_versions,
  } = query;

  let url = get_modrinth_api(ModrinthApiEndpoint::ProjectVersions, Some(resource_id))?;

  let mut params = HashMap::new();
  if mod_loader != ALL_FILTER {
    params.insert(
      "loaders".to_string(),
      format!("[\"{}\"]", mod_loader.to_lowercase()),
    );
  }
  if let Some(first_version) = game_versions.first() {
    if first_version != ALL_FILTER {
      let versions_json = format!(
        "[{}]",
        game_versions
          .iter()
          .map(|v| format!("\"{}\"", v))
          .collect::<Vec<_>>()
          .join(",")
      );

      params.insert("game_versions".to_string(), versions_json);
    }
  }

  let client = app.state::<reqwest::Client>();

  let results = make_modrinth_request::<Vec<ModrinthVersionPack>, ()>(
    &client,
    &url,
    ModrinthRequestType::GetWithParams(&params),
  )
  .await?;

  Ok(map_modrinth_file_to_version_pack(results))
}

pub async fn fetch_remote_resource_by_local_modrinth(
  app: &AppHandle,
  file_path: &str,
) -> SJMCLResult<OtherResourceFileInfo> {
  let file_content = fs::read(file_path).map_err(|_| ResourceError::ParseError)?;

  let mut hasher = Sha1::new();
  hasher.update(&file_content);
  let hash = hasher.finalize();
  let hash_string = hex::encode(hash);

  let mut params = HashMap::new();
  params.insert("algorithm".to_string(), "sha1".to_string());

  let url = get_modrinth_api(ModrinthApiEndpoint::VersionFile, Some(&hash_string))?;
  let client = app.state::<reqwest::Client>();

  let version_pack = make_modrinth_request::<ModrinthVersionPack, ()>(
    &client,
    &url,
    ModrinthRequestType::GetWithParams(&params),
  )
  .await?;

  let file_info = version_pack
    .files
    .iter()
    .find(|file| file.hashes.sha1 == hash_string)
    .or_else(|| version_pack.files.first())
    .ok_or(ResourceError::ParseError)?;

  Ok(
    (
      &version_pack,
      file_info,
      if version_pack.loaders.is_empty() {
        None
      } else {
        Some(version_pack.loaders[0].clone())
      },
    )
      .into(),
  )
}

pub async fn fetch_remote_resource_by_id_modrinth(
  app: &AppHandle,
  resource_id: &str,
) -> SJMCLResult<OtherResourceInfo> {
  let url = get_modrinth_api(ModrinthApiEndpoint::Project, Some(resource_id))?;
  let client = app.state::<reqwest::Client>();

  let results =
    make_modrinth_request::<ModrinthProject, ()>(&client, &url, ModrinthRequestType::Get).await?;

  Ok(results.into())
}

pub async fn get_latest_fabric_api_mod_download(
  app: &AppHandle,
  game_version: &str,
  mods_dir: PathBuf,
) -> SJMCLResult<Option<DownloadParam>> {
  const FABRIC_API_MOD_ID: &str = "P7dR8mSH"; // Fabric API Mod Id in Modrinth

  let query = OtherResourceVersionPackQuery {
    resource_id: FABRIC_API_MOD_ID.to_string(),
    mod_loader: "Fabric".to_string(),
    game_versions: vec![game_version.to_string()],
  };

  let version_packs = fetch_resource_version_packs_modrinth(app, &query).await?;

  let version_pack = version_packs.first().ok_or(ResourceError::ParseError)?;

  let mut candidate_files: Vec<&OtherResourceFileInfo> = version_pack
    .items
    .iter()
    .filter(|file| matches!(file.release_type.as_str(), "beta" | "release"))
    .collect();

  if candidate_files.is_empty() {
    return Ok(None);
  }

  candidate_files.sort_by(|a, b| b.file_date.cmp(&a.file_date));

  let latest_file = candidate_files.first().ok_or(ResourceError::ParseError)?;

  let download_url =
    Url::parse(&latest_file.download_url).map_err(|_| ResourceError::ParseError)?;

  let filename = latest_file.file_name.clone();
  let dest_path = mods_dir.join(&filename);

  Ok(Some(DownloadParam {
    src: download_url,
    dest: dest_path,
    filename: Some(filename),
    sha1: Some(latest_file.sha1.clone()),
  }))
}
