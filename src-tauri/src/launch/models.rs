// https://minecraft.wiki/w/Version_formats
use std::fmt;

#[derive(Debug)]
pub enum LaunchError {
  VersionParseError,
}

impl fmt::Display for LaunchError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      LaunchError::VersionParseError => write!(f, "VERSION_PARSE_ERROR"),
    }
  }
}
