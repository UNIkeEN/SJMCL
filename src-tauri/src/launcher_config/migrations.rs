use serde_json::Value;
use serde_json::json;
use sjmcl_migration::MigrationError;

// Migrate old built-in wallpaper choices to the new default preset.
const LEGACY_BUILT_IN_BACKGROUNDS: &[&str] = &["%built-in:Jokull", "%built-in:GNLXC"];

/// Migration helper: convert a legacy `appearance.background` object.
///
/// The built-in wallpaper set changed in 1.2.0; old presets are remapped to the
/// new default preset and `auto_darken` is reset. Invoked by the migration
/// chain when restoring configs written before 1.2.0.
pub fn migrate_background(value: &Value) -> Result<Value, MigrationError> {
  let mut obj = value
    .as_object()
    .cloned()
    .ok_or_else(|| MigrationError::TypeMismatch("background object".into()))?;

  let choice = obj
    .get("choice")
    .and_then(|v| v.as_str())
    .unwrap_or_default();
  if LEGACY_BUILT_IN_BACKGROUNDS.contains(&choice) {
    obj.insert("choice".to_string(), json!("%built-in:Florwyn"));
    obj.insert("autoDarken".to_string(), json!(false));
  }

  Ok(Value::Object(obj))
}

/// Migration helper: convert old `discoverSourceEndpoints` formats.
///
/// Migrated from `Vec<String>` to `Vec<(String, bool)>` with default
/// enabled=true. Invoked by the migration chain when restoring configs written
/// before 1.2.0.
pub fn migrate_discover_sources(value: &Value) -> Result<Value, MigrationError> {
  let Some(items) = value.as_array() else {
    return Ok(Value::Array(Vec::new()));
  };

  Ok(Value::Array(
    items
      .iter()
      .filter_map(|item| match item {
        Value::String(url) => Some(json!([url, true])),
        Value::Array(tuple) if tuple.len() == 2 => Some(Value::Array(tuple.clone())),
        _ => None,
      })
      .collect(),
  ))
}
