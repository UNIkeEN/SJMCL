use crate::error::SJMCLResult;
use crate::resource::models::{OtherResourceSource, ResourceError};
use crate::utils::fs::get_app_resource_filepath;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

fn clean_keyword(word: &str) -> Option<String> {
  const STOP_WORDS: &[&str] = &["a", "of", "the", "for", "mod", "with", "and", "ftb"];

  let cleaned = word
    .trim_start_matches(['{', '[', '(', '"'])
    .trim_end_matches(['}', ']', ')', '"'])
    .trim_matches('-')
    .trim_matches('_')
    .to_lowercase();

  if cleaned.is_empty() {
    return None;
  }
  if STOP_WORDS.contains(&cleaned.as_str()) {
    return None;
  }
  if cleaned.parse::<f64>().is_ok() {
    return None; // pure number
  }

  Some(cleaned)
}

fn extract_search_words(text: &str) -> Vec<String> {
  text
    .split(|c: char| !c.is_alphanumeric())
    .filter_map(clean_keyword)
    .collect()
}

fn calculate_similarity(source: &str, query: &str) -> f64 {
  let source_clean: String = source.to_lowercase().replace(" ", "");
  let query_clean: String = query.to_lowercase().replace(" ", "");

  let source_length = source_clean.len();
  let query_length = query_clean.len();

  let mut source_chars: Vec<char> = source_clean.chars().collect();
  let query_chars: Vec<char> = query_clean.chars().collect();

  if query_chars.is_empty() || source_chars.is_empty() {
    return 0.0;
  }

  let mut qp = 0; // query position
  let mut len_sum = 0.0;

  // Process each position in query as starting point
  while qp < query_chars.len() {
    let mut sp = 0;
    let mut len_max = 0;
    let mut sp_max = 0;

    // Find maximum substring starting from qp
    while sp < source_chars.len() {
      let mut len = 0;
      while (qp + len) < query_chars.len()
        && (sp + len) < source_chars.len()
        && source_chars[sp + len] == query_chars[qp + len]
      {
        len += 1;
      }

      if len > len_max {
        len_max = len;
        sp_max = sp;
      }

      sp += len.max(1);
    }

    if len_max > 0 {
      // Remove matched substring from source to prevent reuse
      let mut new_source_chars = Vec::new();
      new_source_chars.extend_from_slice(&source_chars[0..sp_max]);
      if sp_max + len_max < source_chars.len() {
        new_source_chars.extend_from_slice(&source_chars[sp_max + len_max..]);
      }
      source_chars = new_source_chars;

      // Weight based on length and position
      let inc_weight = (1.4_f64.powi(3 + len_max as i32) - 3.6).max(0.0);
      let position_bonus = 1.0 + 0.3 * (3.0 - (qp as i32 - sp_max as i32).abs() as f64).max(0.0);

      len_sum += inc_weight * position_bonus;
    }

    qp += len_max.max(1);
  }

  // Final score calculation using original lengths
  let base_score = len_sum / query_length as f64;
  let length_factor = 3.0 / (source_length as f64 + 15.0).sqrt();
  let short_query_bonus = if query_length <= 2 {
    3.0 - query_length as f64
  } else {
    1.0
  };

  base_score * length_factor * short_query_bonus
}

fn is_absolute_match(source: &str, query: &str) -> bool {
  let query_parts: Vec<&str> = query.split_whitespace().collect();

  query_parts.iter().all(|query_part| {
    let source_clean = source.replace(" ", "").to_lowercase();
    source_clean.contains(&query_part.to_lowercase())
  })
}

#[derive(Debug, Clone)]
struct SearchEntry {
  record: MCModRecord,
  similarity: f64,
  absolute_match: bool,
}

#[derive(Debug, Clone)]
pub struct MCModRecord {
  pub mcmod_id: u32,
  pub curseforge_slug: Option<String>,
  pub modrinth_slug: Option<String>,
  pub name: String,
  pub subname: Option<String>,
  pub abbr: Option<String>,
}

pub struct HandledSearchQuery {
  pub query: String,
  pub is_chinese: bool,
}

impl MCModRecord {
  pub fn get_display_name(&self) -> String {
    let mut builder = String::new();

    if let Some(abbr) = &self.abbr {
      if !abbr.trim().is_empty() {
        builder.push('[');
        builder.push_str(abbr.trim());
        builder.push_str("] ");
      }
    }

    builder.push_str(&self.name);

    if let Some(subname) = &self.subname {
      if !subname.trim().is_empty() {
        builder.push_str(" (");
        builder.push_str(subname);
        builder.push(')');
      }
    }

    builder
  }
}

#[derive(Debug)]
pub struct ModDataBase {
  initialized: bool,
  mods: Vec<MCModRecord>,
  modrinth_to_mod: HashMap<String, u32>,
  curseforge_to_mod: HashMap<String, u32>,
}

impl ModDataBase {
  pub fn new() -> Self {
    Self {
      initialized: false,
      mods: Vec::new(),
      modrinth_to_mod: HashMap::new(),
      curseforge_to_mod: HashMap::new(),
    }
  }

  pub fn get_mod_record_by_mcmod_id(&self, mcmod_id: u32) -> Option<&MCModRecord> {
    if !self.initialized || mcmod_id == 0 || mcmod_id > self.mods.len() as u32 {
      return None;
    }
    let index = (mcmod_id - 1) as usize;
    self.mods.get(index)
  }

  pub fn get_mod_record(
    &self,
    resource_slug: &str,
    source: &OtherResourceSource,
  ) -> Option<&MCModRecord> {
    if !self.initialized {
      return None;
    }
    match source {
      OtherResourceSource::Modrinth => self
        .modrinth_to_mod
        .get(resource_slug)
        .and_then(|&mcmod_id| self.get_mod_record_by_mcmod_id(mcmod_id)),
      OtherResourceSource::CurseForge => self
        .curseforge_to_mod
        .get(resource_slug)
        .and_then(|&mcmod_id| self.get_mod_record_by_mcmod_id(mcmod_id)),
      _ => None,
    }
  }

  pub fn get_translated_name(
    &self,
    resource_slug: &str,
    source: &OtherResourceSource,
  ) -> Option<String> {
    self
      .get_mod_record(resource_slug, source)
      .map(|record| record.name.clone())
  }

  pub fn get_mcmod_id(&self, resource_slug: &str, source: &OtherResourceSource) -> Option<u32> {
    self
      .get_mod_record(resource_slug, source)
      .map(|record| record.mcmod_id)
  }

  pub fn get_mods_by_chinese(&self, query: &str, max_results: usize) -> Vec<MCModRecord> {
    if !self.initialized {
      return Vec::new();
    }

    let processed_query = query.split_whitespace().collect::<Vec<&str>>().join(" ");
    if processed_query.is_empty() {
      return Vec::new();
    }

    let mut search_entries = Vec::new();

    // Calculate similarity for each mod
    for mod_record in &self.mods {
      let similarity = calculate_similarity(&mod_record.name, &processed_query);
      let absolute_match = is_absolute_match(&mod_record.name, &processed_query);

      search_entries.push(SearchEntry {
        record: mod_record.clone(),
        similarity,
        absolute_match,
      });
    }

    // Sort: absolute matches first, then by similarity
    search_entries.sort_by(|a, b| match (a.absolute_match, b.absolute_match) {
      (true, false) => std::cmp::Ordering::Less,
      (false, true) => std::cmp::Ordering::Greater,
      _ => b
        .similarity
        .partial_cmp(&a.similarity)
        .unwrap_or(std::cmp::Ordering::Equal),
    });

    // Dynamic similarity threshold based on query length
    let query_char_count = processed_query
      .chars()
      .filter(|c| !c.is_whitespace())
      .count();
    let min_similarity = match query_char_count {
      1 => 0.15,
      2 => 0.12,
      3..=4 => 0.08,
      _ => 0.05,
    };

    let mut results = Vec::new();
    let mut blur_count = 0;

    for entry in search_entries {
      if entry.absolute_match {
        results.push(entry.record); // Absolute matches always included
      } else if entry.similarity >= min_similarity && blur_count < max_results {
        results.push(entry.record);
        blur_count += 1;
      }

      if results.len() >= max_results * 2 {
        break;
      }
    }

    results
  }
}

pub async fn initialize_mod_db(app: &AppHandle) -> SJMCLResult<()> {
  let csv_path = get_app_resource_filepath(app, "assets/db/mod_data.csv")
    .ok()
    .unwrap_or_default();
  let content = tokio::fs::read_to_string(&csv_path)
    .await
    .unwrap_or_default();

  let state = app.state::<Mutex<ModDataBase>>();
  let mut cache = state.lock().map_err(|_| ResourceError::ParseError)?;

  if content.is_empty() {
    cache.initialized = true;
    return Ok(());
  }

  let mut reader = csv::Reader::from_reader(content.as_bytes());
  let headers = reader
    .headers()
    .map_err(|_| ResourceError::ParseError)?
    .clone();

  let mcmod_id_index = headers.iter().position(|h| h == "mcmod_id").unwrap();
  let curseforge_slug_index = headers.iter().position(|h| h == "curseforge_slug").unwrap();
  let modrinth_slug_index = headers.iter().position(|h| h == "modrinth_slug").unwrap();
  let name_index = headers.iter().position(|h| h == "name").unwrap();
  let subname_index = headers.iter().position(|h| h == "subname").unwrap();
  let abbr_index = headers.iter().position(|h| h == "abbr").unwrap();

  for record in reader.records() {
    let record = record.map_err(|_| ResourceError::ParseError)?;

    let mcmod_id = record
      .get(mcmod_id_index)
      .unwrap()
      .parse::<u32>()
      .ok()
      .unwrap();
    let name = record.get(name_index).unwrap().trim().to_string();

    let curseforge_slug = record.get(curseforge_slug_index);
    let modrinth_slug = record.get(modrinth_slug_index);
    let subname = record.get(subname_index);
    let abbr = record.get(abbr_index);

    let mod_record = MCModRecord {
      mcmod_id,
      curseforge_slug: curseforge_slug.map(str::to_owned),
      modrinth_slug: modrinth_slug.map(str::to_owned),
      name,
      subname: subname.map(str::to_owned),
      abbr: abbr.map(str::to_owned),
    };

    cache.mods.push(mod_record);

    if let Some(curseforge_slug) = curseforge_slug {
      cache
        .curseforge_to_mod
        .insert(curseforge_slug.to_string(), mcmod_id);
    }
    if let Some(modrinth_slug) = modrinth_slug {
      cache
        .modrinth_to_mod
        .insert(modrinth_slug.to_string(), mcmod_id);
    }
  }

  cache.initialized = true;
  Ok(())
}

pub async fn handle_localized_search_query(
  app: &AppHandle,
  query: &str,
) -> SJMCLResult<HandledSearchQuery> {
  let query = query.split_whitespace().collect::<Vec<_>>().join(" ");

  if !query.chars().any(|c| matches!(c, '\u{4e00}'..='\u{9fbb}')) {
    return Ok(HandledSearchQuery {
      query,
      is_chinese: false,
    });
  }

  let state = app.state::<Mutex<ModDataBase>>();
  let search_results = match state.lock() {
    Ok(cache) => cache.get_mods_by_chinese(&query, 3),
    Err(_) => {
      return Ok(HandledSearchQuery {
        query,
        is_chinese: true,
      })
    }
  };

  if search_results.is_empty() {
    return Ok(HandledSearchQuery {
      query,
      is_chinese: true,
    });
  }

  let mut english_words = HashSet::new();
  let mut final_keywords = Vec::new();

  for mod_record in &search_results {
    let english_name = mod_record
      .subname
      .as_deref()
      .filter(|subname| !subname.trim().is_empty())
      .or(mod_record.curseforge_slug.as_deref())
      .or(mod_record.modrinth_slug.as_deref())
      .unwrap_or(&mod_record.name);

    for word in extract_search_words(english_name) {
      if english_words.insert(word.clone()) {
        final_keywords.push(word);
      }
    }
  }

  Ok(HandledSearchQuery {
    query: if final_keywords.is_empty() {
      query
    } else {
      final_keywords.join(" ")
    },
    is_chinese: true,
  })
}
