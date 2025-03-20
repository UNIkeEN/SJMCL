// https://minecraft.wiki/w/Version_formats
use strum_macros::Display;

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum LaunchError {
  VersionParseError,
  NoSuitableJavaError,
}

impl std::error::Error for LaunchError {}
