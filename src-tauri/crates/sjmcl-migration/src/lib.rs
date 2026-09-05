//! Runtime data model + migration engine for the migration DSL.
//!
//! The `migrations!` proc macro expands to `Migration`/`Op` static data that
//! the engine in this crate executes against `serde_json::Value` documents.

use serde_json::{Map, Value};

/// A three-part version `major.minor.patch`, ordered lexicographically.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Version {
  pub major: u32,
  pub minor: u32,
  pub patch: u32,
}

impl Version {
  pub fn new(major: u32, minor: u32, patch: u32) -> Self {
    Version {
      major,
      minor,
      patch,
    }
  }

  /// Parse a `"major.minor.patch"` string (any or all trailing parts optional).
  pub fn parse(s: &str) -> Result<Self, MigrationError> {
    let mut parts = s.split('.');
    let major = parts
      .next()
      .ok_or_else(|| MigrationError::MissingVersion("empty version string".into()))?
      .parse::<u32>()
      .map_err(|_| MigrationError::MissingVersion(format!("invalid version `{s}`")))?;
    let minor = parts
      .next()
      .map(|p| p.parse::<u32>())
      .transpose()
      .map_err(|_| MigrationError::MissingVersion(format!("invalid version `{s}`")))?
      .unwrap_or(0);
    let patch = parts
      .next()
      .map(|p| p.parse::<u32>())
      .transpose()
      .map_err(|_| MigrationError::MissingVersion(format!("invalid version `{s}`")))?
      .unwrap_or(0);
    if parts.next().is_some() {
      return Err(MigrationError::MissingVersion(format!(
        "version `{s}` has more than three parts"
      )));
    }
    Ok(Version {
      major,
      minor,
      patch,
    })
  }
}

impl std::fmt::Display for Version {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
  }
}

/// A single migration step from `from` to `to` (adjacent versions).
pub struct Migration {
  pub from: Version,
  pub to: Version,
  pub ops: Vec<Op>,
}

/// A declarative operation applied during a migration.
pub enum Op {
  Rename {
    from: String,
    to: String,
  },
  Move {
    from: String,
    to: String,
  },
  /// Convert the value at `path`.
  ///
  /// - `default: Some(v)` — fill `v` when the path is missing
  /// - `f: Some(fn)` — invoke the helper on the existing value
  /// - otherwise — built-in whitelist conversion (`convert_value`)
  Convert {
    path: String,
    from_ty: Option<String>,
    to_ty: Option<String>,
    default: Option<Value>,
    f: Option<fn(&Value) -> Result<Value, MigrationError>>,
  },
  Remove {
    path: String,
  },
}

/// Errors produced while applying a migration to a document.
#[derive(Debug)]
pub enum MigrationError {
  MissingVersion(String),
  NoPath(Version, Version),
  MissingPath(String),
  TypeMismatch(String),
  Json(serde_json::Error),
}

impl std::fmt::Display for MigrationError {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      MigrationError::MissingVersion(m) => {
        write!(f, "cannot read version from document: {m}")
      }
      MigrationError::NoPath(c, t) => write!(
        f,
        "no migration path from version {c} to target version {t}"
      ),
      MigrationError::MissingPath(p) => {
        write!(f, "path `{p}` does not exist in the document")
      }
      MigrationError::TypeMismatch(t) => write!(f, "path has wrong type: {t}"),
      MigrationError::Json(e) => write!(f, "JSON error: {e}"),
    }
  }
}

impl std::error::Error for MigrationError {
  fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
    match self {
      MigrationError::Json(e) => Some(e),
      _ => None,
    }
  }
}

impl From<serde_json::Error> for MigrationError {
  fn from(e: serde_json::Error) -> Self {
    MigrationError::Json(e)
  }
}

/// Run all forward migrations needed to bring `doc` from its current version
/// (read from `version_key`) up to `target_version` (or the highest registered
/// `to` if `None`).
///
/// Documents written before versioning was introduced have no `version_key`;
/// those fall back to the chain-start version (the first migration's `from`)
/// so the declared migration steps still apply.
pub fn migrate(
  doc: &mut Value,
  migrations: &[Migration],
  target: Option<Version>,
  version_key: &str,
) -> Result<(), MigrationError> {
  let fallback = migrations.first().map(|m| m.from);
  let current = read_version(doc, fallback, version_key)?;
  let target = target.unwrap_or_else(|| migrations.iter().map(|m| m.to).max().unwrap_or(current));
  if target < current {
    return Err(MigrationError::NoPath(current, target));
  }
  if target == current {
    return Ok(());
  }

  // Walk the chain from `current` towards `target` in ascending order.
  let mut cursor = current;
  while cursor < target {
    let step = migrations
      .iter()
      .find(|m| m.from == cursor)
      .ok_or(MigrationError::NoPath(cursor, target))?;
    apply_migration(doc, step, version_key)?;
    cursor = step.to;
  }
  Ok(())
}

fn read_version(
  doc: &Value,
  fallback: Option<Version>,
  key: &str,
) -> Result<Version, MigrationError> {
  match doc.get(key) {
    Some(Value::String(s)) => Version::parse(s),
    Some(Value::Number(n)) => n
      .as_u64()
      .map(|v| Version {
        major: v as u32,
        minor: 0,
        patch: 0,
      })
      .ok_or_else(|| MigrationError::MissingVersion("version is not a positive integer".into())),
    _ => fallback.ok_or_else(|| MigrationError::MissingVersion(format!("missing `{key}` key"))),
  }
}

fn apply_migration(
  doc: &mut Value,
  m: &Migration,
  version_key: &str,
) -> Result<(), MigrationError> {
  for op in &m.ops {
    apply_op(doc, op)?;
  }
  if let Some(obj) = doc.as_object_mut() {
    obj.insert(version_key.to_string(), Value::String(m.to.to_string()));
  } else {
    return Err(MigrationError::MissingVersion(
      "root is not an object".into(),
    ));
  }
  Ok(())
}

fn apply_op(doc: &mut Value, op: &Op) -> Result<(), MigrationError> {
  match op {
    Op::Rename { from, to } => {
      let (from_parent, from_key) = split_path(from);
      let Some(value) = take_optional(doc, from_parent, from_key)? else {
        return Ok(());
      };
      set_at(doc, to, value)?;
      Ok(())
    }
    Op::Move { from, to } => {
      let (from_parent, from_key) = split_path(from);
      let Some(value) = take_optional(doc, from_parent, from_key)? else {
        return Ok(());
      };
      set_at(doc, to, value)?;
      Ok(())
    }
    Op::Convert {
      path,
      to_ty,
      default,
      f,
      ..
    } => {
      let Ok(value) = get_at(doc, path) else {
        // Missing path: fill the default when declared, otherwise no-op.
        if let Some(v) = default {
          set_at(doc, path, v.clone())?;
        }
        return Ok(());
      };
      let converted = match f {
        Some(f) => f(value)?,
        None => match to_ty {
          Some(tt) => convert_value(value, tt)?,
          None => value.clone(),
        },
      };
      set_at(doc, path, converted)?;
      Ok(())
    }
    Op::Remove { path } => {
      let (parent, key) = split_path(path);
      let obj = get_at_mut(doc, parent)?
        .as_object_mut()
        .ok_or_else(|| MigrationError::TypeMismatch(parent.to_string()))?;
      obj.remove(key);
      Ok(())
    }
  }
}

/// Take a value at `parent.key` if present; `None` if the key (or parent) is
/// absent. Lenient, so migrations can reference optional fields/enum variants
/// that may not be present in a given document.
fn take_optional(
  doc: &mut Value,
  parent: &str,
  key: &str,
) -> Result<Option<Value>, MigrationError> {
  let Ok(parent_val) = get_at_mut(doc, parent) else {
    return Ok(None);
  };
  let Some(obj) = parent_val.as_object_mut() else {
    return Ok(None);
  };
  Ok(obj.remove(key))
}

fn convert_value(value: &Value, to_ty: &str) -> Result<Value, MigrationError> {
  use serde_json::Number;
  match to_ty {
    "u64" | "u32" | "usize" => {
      let n = value
        .as_u64()
        .or_else(|| value.as_str().and_then(|s| s.parse().ok()))
        .ok_or(MigrationError::TypeMismatch("numeric".into()))?;
      Ok(Value::Number(Number::from(n)))
    }
    "i64" | "i32" | "isize" => {
      let n = value
        .as_i64()
        .or_else(|| value.as_str().and_then(|s| s.parse().ok()))
        .ok_or(MigrationError::TypeMismatch("numeric".into()))?;
      Ok(Value::Number(Number::from(n)))
    }
    "f64" | "f32" => {
      let n = value
        .as_f64()
        .or_else(|| value.as_str().and_then(|s| s.parse().ok()))
        .ok_or(MigrationError::TypeMismatch("float".into()))?;
      Number::from_f64(n)
        .map(Value::Number)
        .ok_or(MigrationError::TypeMismatch("float".into()))
    }
    "String" => {
      let s = match value {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        _ => return Err(MigrationError::TypeMismatch("string convertible".into())),
      };
      Ok(Value::String(s))
    }
    "bool" => {
      let b = value
        .as_bool()
        .or_else(|| {
          value.as_str().and_then(|s| match s {
            "true" => Some(true),
            "false" => Some(false),
            _ => None,
          })
        })
        .ok_or(MigrationError::TypeMismatch("bool".into()))?;
      Ok(Value::Bool(b))
    }
    _ => {
      // Unknown target type: try serde_json number passthrough.
      Ok(value.clone())
    }
  }
}

/// Split "a.b.c" into parent path ("a.b") and final key ("c").
fn split_path(path: &str) -> (&str, &str) {
  match path.rfind('.') {
    Some(idx) => (&path[..idx], &path[idx + 1..]),
    None => ("", path),
  }
}

/// Navigate to the value at `path` (dotted). Empty path returns root.
fn get_at<'a>(doc: &'a Value, path: &str) -> Result<&'a Value, MigrationError> {
  if path.is_empty() {
    return Ok(doc);
  }
  let mut cur = doc;
  for seg in path.split('.') {
    cur = cur
      .get(seg)
      .ok_or_else(|| MigrationError::MissingPath(path.to_string()))?;
  }
  Ok(cur)
}

/// Mutably navigate to the value at `path`. Empty path returns root.
fn get_at_mut<'a>(doc: &'a mut Value, path: &str) -> Result<&'a mut Value, MigrationError> {
  if path.is_empty() {
    return Ok(doc);
  }
  let mut cur = doc;
  for seg in path.split('.') {
    cur = cur
      .get_mut(seg)
      .ok_or_else(|| MigrationError::MissingPath(path.to_string()))?;
  }
  Ok(cur)
}

/// Set `value` at `path`, creating intermediate objects as needed.
fn set_at(doc: &mut Value, path: &str, value: Value) -> Result<(), MigrationError> {
  if path.is_empty() {
    *doc = value;
    return Ok(());
  }
  let segs: Vec<&str> = path.split('.').collect();
  let obj = doc
    .as_object_mut()
    .ok_or(MigrationError::TypeMismatch("root object".into()))?;
  let mut cur = obj;
  for seg in &segs[..segs.len() - 1] {
    let entry = cur.entry(*seg).or_insert_with(|| Value::Object(Map::new()));
    cur = entry
      .as_object_mut()
      .ok_or_else(|| MigrationError::TypeMismatch(seg.to_string()))?;
  }
  cur.insert((*segs[segs.len() - 1]).to_string(), value);
  Ok(())
}
