use serde::de::DeserializeOwned;
use serde::Serialize;
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
