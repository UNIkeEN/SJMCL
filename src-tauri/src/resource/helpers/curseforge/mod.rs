pub mod misc;

use murmur2::murmur2;
use serde_json::json;
use std::collections::HashMap;
use std::path::Path;

use crate::error::SJMCLResult;
use crate::resource::models::{
  OtherResourceFileInfo, OtherResourceInfo, OtherResourceSearchQuery, OtherResourceSearchRes,
  OtherResourceVersionPack, OtherResourceVersionPackQuery, ResourceError,
};
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use misc::{
  cvt_category_to_id, cvt_mod_loader_to_id, cvt_sort_by_to_id, cvt_type_to_class_id,
  cvt_version_to_type_id, get_curseforge_api, make_curseforge_request,
  map_curseforge_file_to_version_pack, CurseForgeApiEndpoint, CurseForgeFileInfo,
  CurseForgeFingerprintRes, CurseForgeGetProjectRes, CurseForgeRequestType, CurseForgeSearchRes,
  CurseForgeVersionPackSearchRes,
};

const MINECRAFT_GAME_ID: &str = "432";
const ALL_FILTER: &str = "All";

pub async fn fetch_resource_list_by_name_curseforge(
  app: &AppHandle,
  query: &OtherResourceSearchQuery,
) -> SJMCLResult<OtherResourceSearchRes> {
  let url = get_curseforge_api(CurseForgeApiEndpoint::Search, None)?;

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
  params.insert("gameId".to_string(), MINECRAFT_GAME_ID.to_string());
  params.insert("classId".to_string(), class_id.to_string());
  params.insert("searchFilter".to_string(), search_query.to_string());
  if game_version != ALL_FILTER {
    params.insert("gameVersion".to_string(), game_version.to_string());
  }
  if selected_tag != ALL_FILTER {
    params.insert(
      "categoryId".to_string(),
      cvt_category_to_id(selected_tag, class_id).to_string(),
    );
  }
  params.insert("sortField".to_string(), sort_field.to_string());
  params.insert("sortOrder".to_string(), sort_order.to_string());
  params.insert("index".to_string(), (page * page_size).to_string());
  params.insert("pageSize".to_string(), page_size.to_string());

  let client = app.state::<reqwest::Client>();
  let results = make_curseforge_request::<CurseForgeSearchRes, ()>(
    &client,
    &url,
    CurseForgeRequestType::GetWithParams(&params),
  )
  .await?;
  Ok(results.into())
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
    let url = get_curseforge_api(CurseForgeApiEndpoint::ModFiles, Some(resource_id))?;

    let mut params = HashMap::new();
    if mod_loader != ALL_FILTER {
      params.insert(
        "modLoaderType".to_string(),
        cvt_mod_loader_to_id(mod_loader).to_string(),
      );
    }
    if let Some(version) = game_versions.first() {
      if version != ALL_FILTER {
        params.insert(
          "gameVersionTypeId".to_string(),
          cvt_version_to_type_id(version).to_string(),
        );
      }
    }
    params.insert("index".to_string(), (page * page_size).to_string());
    params.insert("pageSize".to_string(), page_size.to_string());

    let client = app.state::<reqwest::Client>();

    let results = make_curseforge_request::<CurseForgeVersionPackSearchRes, ()>(
      &client,
      &url,
      CurseForgeRequestType::GetWithParams(&params),
    )
    .await?;

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
  file_path: &str,
) -> SJMCLResult<OtherResourceFileInfo> {
  let file_path = Path::new(file_path);
  if !file_path.exists() {
    return Err(ResourceError::ParseError.into());
  }

  let file_content = std::fs::read(file_path).map_err(|_| ResourceError::ParseError)?;

  let filtered_bytes: Vec<u8> = file_content
    .into_iter()
    .filter(|&byte| !matches!(byte, 0x09 | 0x0a | 0x0d | 0x20))
    .collect();

  let hash = murmur2(&filtered_bytes, 1) as u64;

  let url = get_curseforge_api(CurseForgeApiEndpoint::Fingerprints, None)?;
  let payload = json!({
    "fingerprints": [hash]
  });

  let client = app.state::<reqwest::Client>();
  let fingerprint_response = make_curseforge_request::<CurseForgeFingerprintRes, _>(
    &client,
    &url,
    CurseForgeRequestType::Post(&payload),
  )
  .await?;

  if let Some(exact_match) = fingerprint_response.data.exact_matches.first() {
    let cf_file = &exact_match.file;
    Ok((cf_file, None).into())
  } else {
    Err(ResourceError::ParseError.into())
  }
}

pub async fn fetch_remote_resource_by_id_curseforge(
  app: &AppHandle,
  resource_id: &str,
) -> SJMCLResult<OtherResourceInfo> {
  let url = get_curseforge_api(CurseForgeApiEndpoint::Project, Some(resource_id))?;
  let client = app.state::<reqwest::Client>();

  let results = make_curseforge_request::<CurseForgeGetProjectRes, ()>(
    &client,
    &url,
    CurseForgeRequestType::Get,
  )
  .await?;

  Ok(results.data.into())
}
