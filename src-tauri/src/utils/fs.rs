use std::fs;
use std::path::Path;

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
