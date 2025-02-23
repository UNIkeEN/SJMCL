use crate::error::SJMCLError;
use regex::Regex;
use std::path::{Path, PathBuf};
use std::{fs, io};

pub fn get_subdirectories<P: AsRef<Path>>(path: P) -> Result<Vec<PathBuf>, SJMCLError> {
  fs::read_dir(path)?
    .filter_map(|entry| match entry {
      Ok(entry) => {
        if let Ok(file_type) = entry.file_type() {
          if file_type.is_dir() {
            return Some(Ok(entry.path()));
          }
        }
        None
      }
      Err(e) => Some(Err(SJMCLError(format!("Entry Error: {}", e)))),
    })
    .collect()
}

pub fn get_files_with_regex<P: AsRef<Path>>(
  path: P,
  pattern: &Regex,
) -> Result<Vec<PathBuf>, SJMCLError> {
  let dir_entries = fs::read_dir(&path).map_err(|e| {
    let error_message = match e.kind() {
      io::ErrorKind::NotFound => "Path does not exist".to_string(),
      _ => format!("IO Error: {}", e),
    };
    SJMCLError(error_message)
  })?;

  let mut matching_files = Vec::new();

  for entry in dir_entries {
    let entry = entry.map_err(|e| SJMCLError(format!("Read Entry Error: {}", e)))?;
    let path = entry.path();

    if let Some(file_name) = path.file_name() {
      if let Some(file_name_str) = file_name.to_str() {
        if pattern.is_match(file_name_str) {
          matching_files.push(path);
        }
      }
    }
  }

  Ok(matching_files)
}
