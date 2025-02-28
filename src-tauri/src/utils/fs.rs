use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};

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
