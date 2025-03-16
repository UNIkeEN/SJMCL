use crate::error::{SJMCLError, SJMCLResult};
use serde_json::{self, Value};
use std::fs;
use std::path::PathBuf;

// https://github.com/HMCL-dev/HMCL/blob/d9e3816b8edf9e7275e4349d4fc67a5ef2e3c6cf/HMCLCore/src/main/java/org/jackhuang/hmcl/game/DefaultGameRepository.java#L321
pub fn rename_game_version_id(src_dir: &PathBuf, dst_id: &String) -> SJMCLResult<PathBuf> {
  // assume that nothing is incorrect
  // TODO: 1. async; 2. atomic
  let src_id = src_dir
    .file_name()
    .ok_or(SJMCLError("empty filestem".to_string()))?
    .to_string_lossy()
    .to_string();
  let version_root = src_dir
    .parent()
    .ok_or(SJMCLError("empty parent".to_string()))?;
  let dst_dir = version_root.join(&dst_id);
  let src_json_path = src_dir.join(format!("{}.json", src_id));
  let mut client_json: Value = serde_json::from_reader(fs::File::open(&src_json_path)?)?;
  if let Some(obj) = client_json.as_object_mut() {
    if let Some(obj_id) = obj.get_mut("id") {
      *obj_id = Value::String(dst_id.clone());
    }
  }
  let dst_json_path = dst_dir.join(format!("{}.json", dst_id));
  fs::create_dir(&dst_dir)?;
  fs::write(dst_json_path, client_json.to_string())?;
  let src_jar_path = src_dir.join(format!("{}.jar", src_id));
  let dst_jar_path = dst_dir.join(format!("{}.jar", dst_id));
  fs::rename(&src_jar_path, dst_jar_path)?;
  fs::remove_file(src_json_path)?;
  fs::remove_dir(src_dir)?;
  Ok(dst_dir)
}
