use crate::error::SJMCLError;
use regex::Regex;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::{fs, io};

pub fn copy_whole_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
  if !dst.exists() {
    fs::create_dir_all(dst)?;
  }

  for entry in fs::read_dir(src)? {
    let entry = entry?;
    let entry_path = entry.path();
    let dest_path = dst.join(entry.file_name());

    if entry_path.is_dir() {
      copy_whole_dir(&entry_path, &dest_path)?;
    } else {
      fs::copy(&entry_path, &dest_path)?;
    }
  }
  Ok(())
}

pub fn generate_unique_filename(base_path: &Path, filename: &OsStr) -> PathBuf {
  let (name, extension) = split_filename(filename);
  let mut dest_path = base_path.join(filename);
  let mut counter = 1;

  while dest_path.exists() {
    let new_filename = format!(
      "{} copy{}",
      name,
      if counter > 1 {
        format!(" {}", counter)
      } else {
        String::new()
      }
    );

    let new_filename = if !extension.is_empty() {
      format!("{}.{}", new_filename, extension)
    } else {
      new_filename
    };

    dest_path = base_path.join(new_filename);
    counter += 1;
  }

  dest_path
}

pub fn split_filename(filename: &OsStr) -> (String, String) {
  let filename_str = filename.to_string_lossy();
  if let Some(dot_index) = filename_str.rfind('.') {
    let name = filename_str[..dot_index].to_string();
    let extension = filename_str[dot_index + 1..].to_string();
    (name, extension)
  } else {
    (filename_str.to_string(), String::new())
  }
}

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
