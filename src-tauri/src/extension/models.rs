use crate::utils::image::ImageWrapper;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use strum_macros::Display;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExtensionMetadata {
  pub identifier: String,
  pub name: String,
  pub description: Option<String>,
}

impl ExtensionMetadata {
  pub fn validate(&self) -> Result<(), ExtensionError> {
    Self::validate_identifier(&self.identifier)?;
    if self.name.trim().is_empty() {
      return Err(ExtensionError::InvalidName);
    }
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
  #[serde(default)]
  pub icon_src: ImageWrapper,
}

impl ExtensionInfo {
  pub fn new(metadata: ExtensionMetadata, icon_src: ImageWrapper) -> Self {
    Self { metadata, icon_src }
  }
}

static IDENTIFIER_PATTERN: LazyLock<regex::Regex> = LazyLock::new(|| {
  regex::Regex::new(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$")
    .expect("identifier regex should be valid")
});

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum ExtensionError {
  InvalidPackageFormat,
  InvalidIdentifier,
  InvalidName,
  DuplicateIdentifier,
  ExtensionNotFound,
}

impl std::error::Error for ExtensionError {}
