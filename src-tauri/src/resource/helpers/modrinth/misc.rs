use crate::error::SJMCLResult;
use crate::resource::models::{
  OtherResourceDependency, OtherResourceFileInfo, OtherResourceInfo, OtherResourceSearchRes,
  OtherResourceSource, OtherResourceVersionPack, ResourceError,
};
use serde::Deserialize;
use tauri_plugin_http::reqwest;

use super::super::misc::version_pack_sort;

// Enum to represent different request types
#[allow(dead_code)] // Post is not used now, but may be in the future
pub enum ModrinthRequestType<'a, P> {
  GetWithParams(&'a std::collections::HashMap<String, String>),
  Get,
  Post(&'a P),
}

pub async fn make_modrinth_request<T, P>(
  client: &reqwest::Client,
  url: &str,
  request_type: ModrinthRequestType<'_, P>,
) -> SJMCLResult<T>
where
  T: serde::de::DeserializeOwned,
  P: serde::Serialize,
{
  let request_builder = match request_type {
    ModrinthRequestType::GetWithParams(params) => client.get(url).query(params),
    ModrinthRequestType::Get => client.get(url),
    ModrinthRequestType::Post(payload) => client.post(url).json(payload),
  };

  let response = request_builder
    .send()
    .await
    .map_err(|_| ResourceError::NetworkError)?;

  if !response.status().is_success() {
    return Err(ResourceError::NetworkError.into());
  }

  response
    .json::<T>()
    .await
    .map_err(|_| ResourceError::ParseError.into())
}

#[derive(Debug, Clone, Copy)]
pub enum ModrinthApiEndpoint {
  Search,
  ProjectVersions,
  VersionFile,
  Project,
}

pub fn get_modrinth_api(endpoint: ModrinthApiEndpoint, param: Option<&str>) -> SJMCLResult<String> {
  let base_url = "https://api.modrinth.com/v2";

  let url_str = match endpoint {
    ModrinthApiEndpoint::Search => format!("{}/search", base_url),
    ModrinthApiEndpoint::ProjectVersions => {
      let project_id = param.ok_or(ResourceError::ParseError)?;
      format!("{}/project/{}/version", base_url, project_id)
    }
    ModrinthApiEndpoint::VersionFile => {
      let hash = param.ok_or(ResourceError::ParseError)?;
      format!("{}/version_file/{}", base_url, hash)
    }
    ModrinthApiEndpoint::Project => {
      let project_id = param.ok_or(ResourceError::ParseError)?;
      format!("{}/project/{}", base_url, project_id)
    }
  };

  Ok(url_str)
}

// A unified struct for both search projects and get project by id responses
#[derive(Deserialize, Debug)]
pub struct ModrinthProject {
  #[serde(alias = "id")]
  pub project_id: String,
  pub project_type: String,
  pub slug: String,
  pub title: String,
  pub description: String,
  pub categories: Vec<String>,
  pub downloads: u32,
  pub icon_url: String,
  #[serde(alias = "updated")]
  pub date_modified: String,
}

#[derive(Deserialize, Debug)]
pub struct ModrinthSearchRes {
  pub hits: Vec<ModrinthProject>,
  pub total_hits: u32,
  pub offset: u32,
  pub limit: u32,
}

structstruck::strike! {
#[strikethrough[derive(Deserialize, Debug)]]
  pub struct ModrinthFileInfo {
    pub url: String,
    pub filename: String,
    pub hashes: pub struct {
      pub sha1: String,
    },
  }
}

structstruck::strike! {
#[strikethrough[derive(Deserialize, Debug)]]
  pub struct ModrinthVersionPack {
    pub project_id: String,
    pub dependencies: Vec<pub struct {
      pub project_id: String,
      pub dependency_type: String,
    }>,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub name: String,
    pub date_published: String,
    pub downloads: u32,
    pub version_type: String,
    pub files: Vec<ModrinthFileInfo>,
  }
}

fn normalize_modrinth_loader(loader: &str) -> Option<String> {
  if loader.is_empty() || loader == "minecraft" {
    None
  } else {
    match loader.to_lowercase().as_str() {
      "forge" => Some("Forge".to_string()),
      "fabric" => Some("Fabric".to_string()),
      "neoforge" => Some("NeoForge".to_string()),
      "vanilla" => Some("Vanilla".to_string()),
      "iris" => Some("Iris".to_string()),
      "canvas" => Some("Canvas".to_string()),
      "optifine" => Some("OptiFine".to_string()),
      _ => Some(loader.to_string()),
    }
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
      version.game_versions.clone()
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
          .map(|file| (&version, file, normalize_modrinth_loader(loader)).into())
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

impl From<ModrinthProject> for OtherResourceInfo {
  fn from(project: ModrinthProject) -> Self {
    Self {
      id: project.project_id,
      _type: project.project_type,
      name: project.title,
      description: project.description,
      icon_src: project.icon_url,
      website_url: format!("https://modrinth.com/mod/{}", project.slug),
      tags: project.categories,
      last_updated: project.date_modified,
      downloads: project.downloads,
      source: OtherResourceSource::Modrinth,
    }
  }
}

impl From<(&ModrinthVersionPack, &ModrinthFileInfo, Option<String>)> for OtherResourceFileInfo {
  fn from(
    (version, file, loader): (&ModrinthVersionPack, &ModrinthFileInfo, Option<String>),
  ) -> Self {
    Self {
      resource_id: version.project_id.clone(),
      name: version.name.clone(),
      release_type: version.version_type.clone(),
      downloads: version.downloads,
      file_date: version.date_published.clone(),
      download_url: file.url.clone(),
      sha1: file.hashes.sha1.clone(),
      file_name: file.filename.clone(),
      dependencies: version
        .dependencies
        .iter()
        .map(|d| OtherResourceDependency {
          resource_id: d.project_id.clone(),
          relation: d.dependency_type.clone(),
        })
        .collect(),
      loader,
    }
  }
}

impl From<ModrinthSearchRes> for OtherResourceSearchRes {
  fn from(res: ModrinthSearchRes) -> Self {
    let list = res.hits.into_iter().map(OtherResourceInfo::from).collect();

    Self {
      list,
      total: res.total_hits,
      page: res.offset / res.limit,
      page_size: res.limit,
    }
  }
}
