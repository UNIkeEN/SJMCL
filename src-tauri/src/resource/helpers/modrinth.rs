use crate::error::SJMCLResult;
use crate::resource::models::{
  OtherResourceFileInfo, OtherResourceInfo, OtherResourceSearchQuery, OtherResourceSearchRes,
  OtherResourceVersionPack, OtherResourceVersionPackQuery, ResourceError,
};
use hex;
use serde::Deserialize;
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::fs;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use super::sort::version_pack_sort;

#[derive(Deserialize, Debug)]
pub struct ModrinthProject {
  pub project_id: String,
  pub project_type: String,
  pub slug: String,
  pub title: String,
  pub description: String,
  pub display_categories: Vec<String>,
  pub downloads: u32,
  pub icon_url: String,
  pub date_modified: String,
}

#[derive(Deserialize, Debug)]
pub struct ModrinthSearchRes {
  pub hits: Vec<ModrinthProject>,
  pub total_hits: u32,
  pub offset: u32,
  pub limit: u32,
}

#[derive(Deserialize, Debug)]
pub struct ModrinthFileHash {
  pub sha1: String,
}

#[derive(Deserialize, Debug)]
pub struct ModrinthFile {
  pub url: String,
  pub filename: String,
  pub hashes: ModrinthFileHash,
}

#[derive(Deserialize, Debug)]
pub struct ModrinthVersionPack {
  pub project_id: String,
  pub game_versions: Vec<String>,
  pub loaders: Vec<String>,
  pub name: String,
  pub date_published: String,
  pub downloads: u32,
  pub version_type: String,
  pub files: Vec<ModrinthFile>,
}

pub fn map_modrinth_to_resource_info(res: ModrinthSearchRes) -> OtherResourceSearchRes {
  let list = res
    .hits
    .into_iter()
    .map(|p| OtherResourceInfo {
      id: p.project_id,
      _type: p.project_type,
      name: p.title,
      description: p.description,
      icon_src: p.icon_url,
      website_url: format!("https://modrinth.com/mod/{}", p.slug),
      tags: p.display_categories,
      last_updated: p.date_modified,
      downloads: p.downloads,
      source: "Modrinth".to_string(),
    })
    .collect();

  OtherResourceSearchRes {
    list,
    total: res.total_hits,
    page: res.offset / res.limit,
    page_size: res.limit,
  }
}

pub fn map_modrinth_file_to_version_pack(
  res: Vec<ModrinthVersionPack>,
) -> Vec<OtherResourceVersionPack> {
  let mut version_packs = std::collections::HashMap::new();

  for version in res {
    let game_versions = if version.game_versions.is_empty() {
      vec!["".to_string()]
    } else {
      version.game_versions
    };

    const ALLOWED_LOADERS: &[&str] = &[
      "forge",
      "fabric",
      "neoforge",
      "vanilla",
      "iris",
      "canvas",
      "optifine",
      "minecraft",
    ];

    let loaders = if version.loaders.is_empty() {
      vec!["".to_string()]
    } else {
      version
        .loaders
        .iter()
        .filter(|loader| ALLOWED_LOADERS.contains(&loader.as_str()))
        .cloned()
        .collect::<Vec<_>>()
    };

    for game_version in &game_versions {
      for loader in &loaders {
        let file_infos = version
          .files
          .iter()
          .map(|file| OtherResourceFileInfo {
            resource_id: version.project_id.clone(),
            name: version.name.clone(),
            release_type: version.version_type.clone(),
            downloads: version.downloads,
            file_date: version.date_published.clone(),
            download_url: file.url.clone(),
            sha1: file.hashes.sha1.clone(),
            file_name: file.filename.clone(),
            loader: if loader.is_empty() || loader == "minecraft" {
              None
            } else {
              match loader.as_str() {
                "forge" => Some("Forge".to_string()),
                "fabric" => Some("Fabric".to_string()),
                "neoforge" => Some("NeoForge".to_string()),
                "vanilla" => Some("Vanilla".to_string()),
                "iris" => Some("Iris".to_string()),
                "canvas" => Some("Canvas".to_string()),
                "optifine" => Some("OptiFine".to_string()),
                _ => Some(loader.clone()),
              }
            },
          })
          .collect::<Vec<_>>();

        version_packs
          .entry(game_version.clone())
          .or_insert_with(|| OtherResourceVersionPack {
            name: game_version.clone(),
            items: Vec::new(),
          })
          .items
          .extend(file_infos);
      }
    }
  }

  let mut list: Vec<OtherResourceVersionPack> = version_packs.into_values().collect();
  list.sort_by(version_pack_sort);

  list
}

pub async fn fetch_resource_list_by_name_modrinth(
  app: &AppHandle,
  query: &OtherResourceSearchQuery,
) -> SJMCLResult<OtherResourceSearchRes> {
  let url = "https://api.modrinth.com/v2/search";

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
  if !game_version.is_empty() && game_version != "All" {
    facets.push(vec![format!("versions:{}", game_version)]);
  }
  if !selected_tag.is_empty() && selected_tag != "All" {
    facets.push(vec![format!("categories:{}", selected_tag)]);
  }

  let mut params = HashMap::new();
  params.insert("query", search_query.to_string());
  params.insert("facets", serde_json::to_string(&facets).unwrap());
  params.insert("offset", (page * page_size).to_string());
  params.insert("limit", page_size.to_string());
  params.insert("index", sort_by.to_string());

  let client = app.state::<reqwest::Client>();

  if let Ok(response) = client.get(url).query(&params).send().await {
    if response.status().is_success() {
      match response.json::<ModrinthSearchRes>().await {
        Ok(results) => Ok(map_modrinth_to_resource_info(results)),
        Err(_) => Err(ResourceError::ParseError.into()),
      }
    } else {
      Err(ResourceError::NetworkError.into())
    }
  } else {
    Err(ResourceError::NetworkError.into())
  }
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

  let url = format!(
    "https://api.modrinth.com/v2/project/{}/version",
    resource_id
  );

  let mut params = HashMap::new();
  if mod_loader != "All" {
    params.insert("loaders", format!("[\"{}\"]", mod_loader.to_lowercase()));
  }
  if game_versions.first() != Some(&"All".to_string()) {
    let versions_json = format!(
      "[{}]",
      game_versions
        .iter()
        .map(|v| format!("\"{}\"", v))
        .collect::<Vec<_>>()
        .join(",")
    );

    params.insert("game_versions", versions_json);
  }

  let client = app.state::<reqwest::Client>();

  let response = client
    .get(url)
    .query(&params)
    .send()
    .await
    .map_err(|_| ResourceError::NetworkError)?;

  if !response.status().is_success() {
    return Err(ResourceError::NetworkError.into());
  }

  let results = response
    .json::<Vec<ModrinthVersionPack>>()
    .await
    .map_err(|_| ResourceError::ParseError)?;

  Ok(map_modrinth_file_to_version_pack(results))
}

pub async fn fetch_remote_resource_by_local_modrinth(
  app: &AppHandle,
  file_path: &String,
) -> SJMCLResult<OtherResourceFileInfo> {
  let file_content = fs::read(file_path).map_err(|_| ResourceError::ParseError)?;

  let mut hasher = Sha1::new();
  hasher.update(&file_content);
  let hash = hasher.finalize();
  let hash_string = hex::encode(hash);

  let mut params = HashMap::new();
  params.insert("algorithm", "sha1");

  let url = format!("https://api.modrinth.com/v2/version_file/{}", hash_string);
  let client = app.state::<reqwest::Client>();

  let response = client
    .get(&url)
    .query(&params)
    .send()
    .await
    .map_err(|_| ResourceError::NetworkError)?;

  if !response.status().is_success() {
    return Err(ResourceError::NetworkError.into());
  }

  let version_pack = response
    .json::<ModrinthVersionPack>()
    .await
    .map_err(|_| ResourceError::ParseError)?;

  let file_info = version_pack
    .files
    .iter()
    .find(|file| file.hashes.sha1 == hash_string)
    .or_else(|| version_pack.files.first())
    .ok_or(ResourceError::ParseError)?;

  Ok(OtherResourceFileInfo {
    resource_id: version_pack.project_id.clone(),
    name: version_pack.name,
    release_type: version_pack.version_type,
    downloads: version_pack.downloads,
    file_date: version_pack.date_published,
    download_url: file_info.url.clone(),
    sha1: file_info.hashes.sha1.clone(),
    file_name: file_info.filename.clone(),
    loader: if version_pack.loaders.is_empty() {
      None
    } else {
      Some(version_pack.loaders[0].clone())
    },
  })
}
