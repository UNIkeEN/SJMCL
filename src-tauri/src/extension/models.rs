use crate::utils::image::ImageWrapper;
use semver::Version;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use strum_macros::Display;

structstruck::strike! {
  #[strikethrough[derive(Debug, Clone, Serialize, Deserialize)]]
  #[strikethrough[serde(rename_all = "camelCase")]]
  pub struct ExtensionMetadata {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    pub minimal_launcher_version: Option<String>,
    pub frontend: Option<pub struct ExtensionFrontend {
      pub entry: String,
    }>,
  }
}

impl ExtensionMetadata {
  pub fn validate(&mut self) -> Result<(), ExtensionError> {
    Self::validate_identifier(&self.identifier)?;
    if self.name.trim().is_empty() {
      return Err(ExtensionError::InvalidName);
    }
    if let Some(frontend) = &self.frontend {
      if frontend.entry.trim().is_empty() {
        return Err(ExtensionError::InvalidFrontendEntry);
      }
    }

    self.version = self.version.take().and_then(|version| {
      let version = version.trim().to_string();
      if version.is_empty() || Version::parse(&version).is_err() {
        None
      } else {
        Some(version)
      }
    });
    self.minimal_launcher_version = Some(
      self
        .minimal_launcher_version
        .take()
        .map(|version| version.trim().to_string())
        .filter(|version| Version::parse(version).is_ok())
        .unwrap_or_else(|| "0.0.0".to_string()),
    );

    Ok(())
  }

  pub fn validate_identifier(identifier: &str) -> Result<(), ExtensionError> {
    if IDENTIFIER_PATTERN.is_match(identifier) {
      Ok(())
    } else {
      Err(ExtensionError::InvalidIdentifier)
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInfo {
  #[serde(flatten)]
  pub metadata: ExtensionMetadata,
  pub path: String,
  #[serde(default)]
  pub icon_src: ImageWrapper,
}

impl ExtensionInfo {
  pub fn new(metadata: ExtensionMetadata, path: String, icon_src: ImageWrapper) -> Self {
    Self {
      metadata,
      path,
      icon_src,
    }
  }
}

static IDENTIFIER_PATTERN: LazyLock<regex::Regex> = LazyLock::new(|| {
  regex::Regex::new(r"^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$")
    .expect("identifier regex should be valid")
});

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum ExtensionError {
  InvalidPackageFormat,
  InvalidIdentifier,
  InvalidName,
  InvalidFrontendEntry,
  LauncherVersionTooLow,
  IdentifierMismatch,
  // DuplicateIdentifier,
  ExtensionNotFound,
}

impl std::error::Error for ExtensionError {}
