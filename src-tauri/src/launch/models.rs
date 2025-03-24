// https://minecraft.wiki/w/Version_formats
use strum_macros::Display;

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum LaunchError {
  VersionParseError,
  NoSuitableJavaError,
  LaunchParamsError,
}

impl std::error::Error for LaunchError {}

#[derive(Debug, Clone)]
pub struct CommandContent {
  pub exe: String,
  pub args: Vec<String>,
  pub nice: i32,
}
