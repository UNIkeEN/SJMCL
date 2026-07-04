use serde::Deserialize;
use serde::de::Deserializer;
use serde_json::Value;

use crate::launcher_config::models::AppearanceBackgroundConfig;

// Migrate old built-in wallpaper choices to the new default preset.
const LEGACY_BUILT_IN_BACKGROUNDS: &[&str] = &["%built-in:Jokull", "%built-in:GNLXC"];

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct BackgroundPayload {
  choice: String,
  random_custom: bool,
  auto_darken: bool,
}

pub fn deserialize_background<'de, D>(
  deserializer: D,
) -> Result<AppearanceBackgroundConfig, D::Error>
where
  D: Deserializer<'de>,
{
  let mut payload = BackgroundPayload::deserialize(deserializer)?;

  if LEGACY_BUILT_IN_BACKGROUNDS.contains(&payload.choice.as_str()) {
    payload.choice = "%built-in:Florwyn".to_string();
    payload.auto_darken = false;
  }

  Ok(AppearanceBackgroundConfig {
    choice: payload.choice,
    random_custom: payload.random_custom,
    auto_darken: payload.auto_darken,
  })
}

// Deserializing discover sources from old and new formats.
// Migrated from Vec<String> to Vec<(String, bool)> with default enabled=true
pub fn deserialize_discover_sources<'de, D>(
  deserializer: D,
) -> Result<Vec<(String, bool)>, D::Error>
where
  D: Deserializer<'de>,
{
  let value = match Value::deserialize(deserializer) {
    Ok(value) => value,
    Err(_) => return Ok(Vec::default()),
  };

  let items = match value.as_array() {
    Some(items) => items,
    None => return Ok(Vec::default()),
  };

  Ok(
    items
      .iter()
      .filter_map(|item| match item {
        Value::String(url) => Some((url.to_string(), true)),
        Value::Array(tuple) if tuple.len() == 2 => {
          let url = tuple.first()?.as_str()?;
          let enabled = tuple.get(1)?.as_bool()?;
          Some((url.to_string(), enabled))
        }
        _ => None,
      })
      .collect(),
  )
}
