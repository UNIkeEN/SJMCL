pub mod misc;

use hex;
use misc::{
  CurseForgeFileInfo, CurseForgeFingerprintRes, CurseForgeGetProjectRes, CurseForgeSearchRes,
  CurseForgeVersionPackSearchRes, cvt_category_to_id, cvt_mod_loader_to_id, cvt_sort_by_to_id,
  cvt_type_to_class_id, cvt_version_to_type_id, get_curseforge_api, make_curseforge_request,
  map_curseforge_file_to_version_pack,
};
use murmur2::murmur2;
use serde_json::json;
use sha1::{Digest, Sha1};
use sjmcl_types::error::SJMCLResult;
use std::collections::HashMap;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::resource::helpers::misc::{
  apply_other_resource_enhancements, apply_other_resource_enhancements_concurrently,
  levenshtein_distance, sort_localized_search_results,
};
use crate::resource::helpers::mod_db::{HandledSearchQuery, handle_localized_search_query};
use crate::resource::models::{
  OtherResourceApiEndpoint, OtherResourceFileInfo, OtherResourceInfo, OtherResourceRequestType,
  OtherResourceSearchQuery, OtherResourceSearchRes, OtherResourceVersionPack,
  OtherResourceVersionPackQuery, ResourceError,
};

const MINECRAFT_GAME_ID: &str = "432";
const ALL_FILTER: &str = "All";
const WORD_PERFECT_MATCH_WEIGHT: usize = 5;

fn tokenize_words(text: &str) -> impl Iterator<Item = &str> {
  text.split_whitespace()
}

pub async fn fetch_resource_list_by_name_curseforge(
  app: &AppHandle,
  query: &OtherResourceSearchQuery,
) -> SJMCLResult<OtherResourceSearchRes> {
  let url = get_curseforge_api(OtherResourceApiEndpoint::Search, None)?;

  let OtherResourceSearchQuery {
    resource_type,
    search_query,
    game_version,
    selected_tag,
    sort_by,
    page,
    page_size,
  } = query;

  let handled_search_query = handle_localized_search_query(app, search_query)
    .await
    .unwrap_or_else(|_| HandledSearchQuery {
      query: search_query.clone(),
      is_chinese: false,
    });

  let class_id = cvt_type_to_class_id(resource_type);
  let sort_field = if handled_search_query.is_chinese {
    cvt_sort_by_to_id("Popularity")
  } else {
    cvt_sort_by_to_id(sort_by)
  };
  let sort_order = match sort_field {
    4 => "asc",
    _ => "desc",
  };

  let mut params = HashMap::new();
  params.insert("gameId".to_string(), MINECRAFT_GAME_ID.to_string());
  params.insert("classId".to_string(), class_id.to_string());
  params.insert(
    "searchFilter".to_string(),
    handled_search_query.query.clone(),
  );
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
    OtherResourceRequestType::GetWithParams(&params),
  )
  .await?;

  let mut search_result: OtherResourceSearchRes = results.into();

  let has_search_filter = !handled_search_query.query.trim().is_empty();
  // Empty search is browsing by the selected API sort; avoid re-ranking by title length.
  let should_rerank_by_search_filter =
    !handled_search_query.is_chinese && sort_by == "Popularity" && has_search_filter;

  if should_rerank_by_search_filter {
    let lower_case_search_filter = handled_search_query.query.to_lowercase();
    let mut search_filter_words = HashMap::new();
    for token in tokenize_words(&lower_case_search_filter) {
      *search_filter_words
        .entry(token.to_string())
        .or_insert(0usize) += 1;
    }

    let mut scored_results: Vec<(OtherResourceInfo, i64)> = search_result
      .list
      .into_iter()
      .map(|resource| {
        let title = resource
          .translated_name
          .as_deref()
          .unwrap_or(resource.name.as_str());
        let lower_case_result = title.to_lowercase();

        let mut diff = levenshtein_distance(&lower_case_search_filter, &lower_case_result) as i64;

        for token in tokenize_words(&lower_case_result) {
          if let Some(count) = search_filter_words.get(token) {
            diff -= (WORD_PERFECT_MATCH_WEIGHT * *count * token.len()) as i64;
          }
        }

        (resource, diff)
      })
      .collect();

    scored_results.sort_by_key(|(_, diff)| *diff);
    search_result.list = scored_results
      .into_iter()
      .map(|(resource, _)| resource)
      .collect();
  }

  apply_other_resource_enhancements_concurrently(app, &mut search_result.list).await;

  if handled_search_query.is_chinese {
    sort_localized_search_results(&mut search_result.list, search_query);
  }

  Ok(search_result)
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
    let url = get_curseforge_api(OtherResourceApiEndpoint::VersionPack, Some(resource_id))?;

    let mut params = HashMap::new();
    if mod_loader != ALL_FILTER {
      params.insert(
        "modLoaderType".to_string(),
        cvt_mod_loader_to_id(mod_loader).to_string(),
      );
    }
    if let Some(version) = game_versions.first()
      && version != ALL_FILTER
    {
      params.insert(
        "gameVersionTypeId".to_string(),
        cvt_version_to_type_id(version).to_string(),
      );
    }
    params.insert("index".to_string(), (page * page_size).to_string());
    params.insert("pageSize".to_string(), page_size.to_string());

    let client = app.state::<reqwest::Client>();

    let results = make_curseforge_request::<CurseForgeVersionPackSearchRes, ()>(
      &client,
      &url,
      OtherResourceRequestType::GetWithParams(&params),
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
  let file_content = tokio::fs::read(file_path)
    .await
    .map_err(|_| ResourceError::ParseError)?;

  // Calculate SHA1 hash of the local file for verification
  let mut hasher = Sha1::new();
  hasher.update(&file_content);
  let local_sha1 = hex::encode(hasher.finalize());

  let filtered_bytes: Vec<u8> = file_content
    .into_iter()
    .filter(|&byte| !matches!(byte, 0x09 | 0x0a | 0x0d | 0x20))
    .collect();

  let hash = murmur2(&filtered_bytes, 1) as u64;

  let url = get_curseforge_api(OtherResourceApiEndpoint::FromLocal, None)?;
  let payload = json!({
    "fingerprints": [hash]
  });

  let client = app.state::<reqwest::Client>();
  let fingerprint_response = make_curseforge_request::<CurseForgeFingerprintRes, _>(
    &client,
    &url,
    OtherResourceRequestType::Post(&payload),
  )
  .await?;

  if let Some(exact_match) = fingerprint_response.data.exact_matches.first() {
    let cf_file = &exact_match.file;

    // Verify SHA1 hash matches between local and remote
    if let Some(remote_sha1) = cf_file.hashes.iter().find(|h| h.algo == 1) {
      if remote_sha1.value.to_lowercase() == local_sha1.to_lowercase() {
        Ok((cf_file, None).into())
      } else {
        Err(ResourceError::ParseError.into())
      }
    } else {
      Err(ResourceError::ParseError.into())
    }
  } else {
    Err(ResourceError::ParseError.into())
  }
}

pub async fn fetch_remote_resource_by_id_curseforge(
  app: &AppHandle,
  resource_id: &str,
) -> SJMCLResult<OtherResourceInfo> {
  let url = get_curseforge_api(OtherResourceApiEndpoint::ById, Some(resource_id))?;
  let client = app.state::<reqwest::Client>();

  let results = make_curseforge_request::<CurseForgeGetProjectRes, ()>(
    &client,
    &url,
    OtherResourceRequestType::Get,
  )
  .await?;

  let mut resource_info: OtherResourceInfo = results.data.into();
  let _ = apply_other_resource_enhancements(app, &mut resource_info).await;

  Ok(resource_info)
}
