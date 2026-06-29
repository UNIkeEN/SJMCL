use serde::Serialize;
use serde::de::DeserializeOwned;
use std::fs;
use std::path::Path;

pub trait Storage {
  fn file_path() -> std::path::PathBuf;

  fn load() -> Result<Self, std::io::Error>
  where
    Self: Sized + DeserializeOwned,
  {
    let json_string = fs::read_to_string(Self::file_path())?;
    let value = serde_json::from_str(&json_string)?;
    Ok(value)
  }

  fn save(&self) -> Result<(), std::io::Error>
  where
    Self: Serialize,
  {
    if let Some(parent) = Self::file_path().parent() {
      fs::create_dir_all(parent)?;
    }
    let json_string = serde_json::to_string_pretty(self)?;
    fs::write(Self::file_path(), json_string)?;
    Ok(())
  }
}

pub async fn load_json_async<T>(file_path: &Path) -> Result<T, std::io::Error>
where
  T: Sized + DeserializeOwned + Send,
{
  let json_string = tokio::fs::read_to_string(file_path).await?;
  let value = serde_json::from_str(&json_string)?;
  Ok(value)
}

pub async fn save_json_async<T>(value: &T, file_path: &Path) -> Result<(), std::io::Error>
where
  T: Serialize + Send,
{
  if let Some(parent) = file_path.parent() {
    fs::create_dir_all(parent)?;
  }
  let json_string = serde_json::to_string_pretty(value)?;
  tokio::fs::write(file_path, json_string).await?;
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde::{Deserialize, Serialize};
  use std::path::PathBuf;

  #[derive(Debug, Deserialize, PartialEq, Serialize)]
  struct JsonValue {
    name: String,
  }

  #[tokio::test]
  async fn async_json_round_trips_through_nested_parent_directory() {
    let file_path = std::env::temp_dir().join(format!(
      "sjmcl-types-storage-test-{}-async/nested/value.json",
      std::process::id()
    ));
    let _ = std::fs::remove_file(&file_path);

    let value = JsonValue {
      name: "launcher".to_string(),
    };

    save_json_async(&value, &file_path).await.unwrap();
    let loaded: JsonValue = load_json_async(&file_path).await.unwrap();

    assert_eq!(loaded, value);

    let _ = std::fs::remove_file(&file_path);
    if let Some(parent) = file_path.parent().and_then(|path| path.parent()) {
      let _ = std::fs::remove_dir_all(parent);
    }
  }

  #[derive(Debug, Deserialize, PartialEq, Serialize)]
  struct StoredValue {
    count: u32,
  }

  impl Storage for StoredValue {
    fn file_path() -> PathBuf {
      std::env::temp_dir().join(format!(
        "sjmcl-types-storage-test-{}-trait/stored.json",
        std::process::id()
      ))
    }
  }

  #[test]
  fn storage_trait_saves_and_loads_json() {
    let file_path = StoredValue::file_path();
    let _ = std::fs::remove_file(&file_path);

    let value = StoredValue { count: 7 };
    value.save().unwrap();

    assert_eq!(StoredValue::load().unwrap(), value);

    let _ = std::fs::remove_file(&file_path);
    if let Some(parent) = file_path.parent() {
      let _ = std::fs::remove_dir_all(parent);
    }
  }
}
