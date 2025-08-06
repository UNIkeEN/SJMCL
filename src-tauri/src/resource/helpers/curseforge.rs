use murmur2::murmur2;
use serde_json::json;
use std::collections::HashMap;
use std::env;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

use crate::error::SJMCLResult;
use crate::resource::helpers::curseforge_convert::cvt_category_to_id;
use crate::resource::models::{
  OtherResourceFileInfo, OtherResourceInfo, OtherResourceSearchQuery, OtherResourceSearchRes,
  OtherResourceSource, OtherResourceVersionPack, OtherResourceVersionPackQuery, ResourceError,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use super::curseforge_convert::{
  cvt_class_id_to_type, cvt_id_to_release_type, cvt_mod_loader_to_id, cvt_sort_by_to_id,
  cvt_type_to_class_id, cvt_version_to_type_id,
};
use super::sort::version_pack_sort;

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeCategory {
  pub name: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeLink {
  pub website_url: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeLogo {
  pub url: String,
}

fn default_logo() -> CurseForgeLogo {
  CurseForgeLogo {
    url: "".to_string(),
  }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeProject {
  pub id: u32,
  pub class_id: u32,
  pub links: CurseForgeLink,
  pub name: String,
  pub summary: String,
  pub categories: Vec<CurseForgeCategory>,
  pub download_count: u32,
  pub logo: Option<CurseForgeLogo>, // In some old projects, logo is null
  pub date_modified: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgePagination {
  pub index: u32,
  pub page_size: u32,
  pub total_count: u32,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct CurseForgeSearchRes {
  pub data: Vec<CurseForgeProject>,
  pub pagination: CurseForgePagination,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct CurseForgeFileHash {
  pub value: String,
  pub algo: u32,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeFileInfo {
  pub mod_id: u32,
  pub display_name: String,
  pub file_name: String,
  pub release_type: u32,
  pub hashes: Vec<CurseForgeFileHash>,
  pub file_date: String,
  pub download_url: Option<String>,
  pub download_count: u32,
  pub game_versions: Vec<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct CurseForgeVersionPackSearchRes {
  pub data: Vec<CurseForgeFileInfo>,
  pub pagination: CurseForgePagination,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeExactMatches {
  pub file: CurseForgeFileInfo,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeFingerprintData {
  pub exact_matches: Vec<CurseForgeExactMatches>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeFingerprintRes {
  pub data: CurseForgeFingerprintData,
}

pub fn map_curseforge_to_resource_info(res: CurseForgeSearchRes) -> OtherResourceSearchRes {
  let list = res
    .data
    .into_iter()
    .map(|p| OtherResourceInfo {
      id: p.id.to_string(),
      _type: cvt_class_id_to_type(p.class_id),
      name: p.name,
      description: p.summary,
      icon_src: p.logo.unwrap_or_else(default_logo).url,
      website_url: p.links.website_url,
      tags: p.categories.iter().map(|c| c.name.clone()).collect(),
      last_updated: p.date_modified,
      downloads: p.download_count,
      source: OtherResourceSource::CurseForge,
    })
    .collect();

  OtherResourceSearchRes {
    list,
    total: res.pagination.total_count,
    page: res.pagination.index / res.pagination.page_size,
    page_size: res.pagination.page_size,
  }
}

fn extract_versions_and_loaders(game_versions: &[String]) -> (Vec<String>, Vec<String>) {
  let mut versions = Vec::new();
  let mut loaders = Vec::new();

  const ALLOWED_LOADERS: &[&str] = &[
    "Forge", "Fabric", "NeoForge", "Vanilla", "Iris", "Canvas", "OptiFine",
  ];

  for v in game_versions {
    if v.starts_with(|c: char| c.is_ascii_digit()) {
      versions.push(v.clone());
    } else if ALLOWED_LOADERS.contains(&v.as_str()) {
      loaders.push(v.clone());
    }
  }

  (versions, loaders)
}

pub fn map_curseforge_file_to_version_pack(
  res: Vec<CurseForgeFileInfo>,
) -> Vec<OtherResourceVersionPack> {
  let mut version_packs = std::collections::HashMap::new();

  for cf_file in res {
    let (versions, loaders) = extract_versions_and_loaders(&cf_file.game_versions);

    let versions = if versions.is_empty() {
      vec!["".to_string()]
    } else {
      versions
    };

    let loaders = if loaders.is_empty() {
      vec![""]
    } else {
      loaders.iter().map(|s| s.as_str()).collect::<Vec<_>>()
    };

    for version in &versions {
      for loader in &loaders {
        let file_info = OtherResourceFileInfo {
          resource_id: cf_file.mod_id.to_string(),
          name: cf_file.display_name.clone(),
          release_type: cvt_id_to_release_type(cf_file.release_type),
          downloads: cf_file.download_count,
          file_date: cf_file.file_date.clone(),
          download_url: cf_file.download_url.clone().unwrap_or_default(),
          sha1: cf_file
            .hashes
            .iter()
            .find(|h| h.algo == 1)
            .map_or("".to_string(), |h| h.value.clone()),
          file_name: cf_file.file_name.clone(),
          loader: if loader.is_empty() {
            None
          } else {
            Some(loader.to_string())
          },
        };

        version_packs
          .entry(version.clone())
          .or_insert_with(|| OtherResourceVersionPack {
            name: version.clone(),
            items: Vec::new(),
          })
          .items
          .push(file_info);
      }
    }
  }

  let mut list: Vec<OtherResourceVersionPack> = version_packs.into_values().collect();
  list.sort_by(version_pack_sort);

  list
}

pub async fn fetch_resource_list_by_name_curseforge(
  app: &AppHandle,
  query: &OtherResourceSearchQuery,
) -> SJMCLResult<OtherResourceSearchRes> {
  let url = "https://api.curseforge.com/v1/mods/search";

  let OtherResourceSearchQuery {
    resource_type,
    search_query,
    game_version,
    selected_tag,
    sort_by,
    page,
    page_size,
  } = query;

  let class_id = cvt_type_to_class_id(resource_type);
  let sort_field = cvt_sort_by_to_id(sort_by);
  let sort_order = match sort_field {
    4 => "asc",
    _ => "desc",
  };

  let mut params = HashMap::new();
  params.insert("gameId", "432".to_string());
  params.insert("classId", class_id.to_string());
  params.insert("searchFilter", search_query.to_string());
  if game_version != "All" {
    params.insert("gameVersion", game_version.to_string());
  }
  if selected_tag != "All" {
    params.insert(
      "categoryId",
      cvt_category_to_id(selected_tag, class_id).to_string(),
    );
  }
  params.insert("sortField", sort_field.to_string());
  params.insert("sortOrder", sort_order.to_string());
  params.insert("index", (page * page_size).to_string());
  params.insert("pageSize", page_size.to_string());

  let client = app.state::<reqwest::Client>();

  let response = client
    .get(url)
    .query(&params)
    .header("x-api-key", env!("SJMCL_CURSEFORGE_API_KEY"))
    .header("accept", "application/json")
    .send()
    .await
    .map_err(|_| ResourceError::NetworkError)?;

  if !response.status().is_success() {
    return Err(ResourceError::NetworkError.into());
  }

  let results = response
    .json::<CurseForgeSearchRes>()
    .await
    .map_err(|_| ResourceError::ParseError)?;

  Ok(map_curseforge_to_resource_info(results))
}

pub async fn fetch_resource_version_packs_curseforge(
  app: &AppHandle,
  query: &OtherResourceVersionPackQuery,
) -> SJMCLResult<Vec<OtherResourceVersionPack>> {
  let mut aggregated_files: Vec<CurseForgeFileInfo> = Vec::new();
  let mut page = 0;
  let page_size = 50;

  let OtherResourceVersionPackQuery {
    resource_id,
    mod_loader,
    game_versions,
  } = query;

  loop {
    let url = format!("https://api.curseforge.com/v1/mods/{}/files", resource_id);

    let mut params = HashMap::new();
    if mod_loader != "All" {
      params.insert(
        "modLoaderType",
        cvt_mod_loader_to_id(mod_loader).to_string(),
      );
    }
    if game_versions.first() != Some(&"All".to_string()) {
      params.insert(
        "gameVersionTypeId",
        cvt_version_to_type_id(game_versions.first().unwrap()).to_string(),
      );
    }
    params.insert("index", (page * page_size).to_string());
    params.insert("pageSize", page_size.to_string());

    let client = app.state::<reqwest::Client>();

    let response = client
      .get(&url)
      .query(&params)
      .header("x-api-key", env!("SJMCL_CURSEFORGE_API_KEY"))
      .header("accept", "application/json")
      .send()
      .await
      .map_err(|_| ResourceError::NetworkError)?;

    if !response.status().is_success() {
      return Err(ResourceError::NetworkError.into());
    }

    let results = response
      .json::<CurseForgeVersionPackSearchRes>()
      .await
      .map_err(|_| ResourceError::ParseError)?;

    let has_more = results.pagination.total_count > (page + 1) * page_size;

    aggregated_files.extend(results.data);

    if !has_more {
      break;
    }
    page += 1;
  }

  Ok(map_curseforge_file_to_version_pack(aggregated_files))
}

pub async fn fetch_remote_resource_by_local_curseforge(
  app: &AppHandle,
  file_path: &String,
) -> SJMCLResult<OtherResourceFileInfo> {
  let file_path = Path::new(&file_path);
  if !file_path.exists() {
    return Err(ResourceError::ParseError.into());
  }

  let file = File::open(file_path).map_err(|_| ResourceError::ParseError)?;
  let mut reader = BufReader::new(file);
  let mut filtered_bytes = Vec::new();
  let mut buffer = [0; 1024];

  loop {
    match reader.read(&mut buffer) {
      Ok(0) => break,
      Ok(len) => {
        for &byte in &buffer[..len] {
          if byte != 0x09 && byte != 0x0a && byte != 0x0d && byte != 0x20 {
            filtered_bytes.push(byte);
          }
        }
      }
      Err(_) => return Err(ResourceError::ParseError.into()),
    }
  }

  let hash = murmur2(&filtered_bytes, 1) as u64;

  let url = "https://api.curseforge.com/v1/fingerprints/432";
  let payload = json!({
    "fingerprints": [hash]
  });

  let client = app.state::<reqwest::Client>();
  let response = client
    .post(url)
    .header("x-api-key", env!("SJMCL_CURSEFORGE_API_KEY"))
    .header("accept", "application/json")
    .header("content-type", "application/json")
    .json(&payload)
    .send()
    .await
    .map_err(|_| ResourceError::NetworkError)?;

  if !response.status().is_success() {
    return Err(ResourceError::NetworkError.into());
  }

  let fingerprint_response = response
    .json::<CurseForgeFingerprintRes>()
    .await
    .map_err(|_| ResourceError::ParseError)?;

  if let Some(exact_match) = fingerprint_response.data.exact_matches.first() {
    let cf_file = &exact_match.file;
    Ok(OtherResourceFileInfo {
      resource_id: cf_file.mod_id.to_string(),
      name: cf_file.display_name.clone(),
      release_type: cvt_id_to_release_type(cf_file.release_type),
      downloads: cf_file.download_count,
      file_date: cf_file.file_date.clone(),
      download_url: cf_file.download_url.clone().unwrap_or_default(),
      sha1: cf_file
        .hashes
        .iter()
        .find(|h| h.algo == 1)
        .map_or("".to_string(), |h| h.value.clone()),
      file_name: cf_file.file_name.clone(),
      loader: None,
    })
  } else {
    Err(ResourceError::ParseError.into())
  }
}
