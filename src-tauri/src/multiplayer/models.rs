use strum_macros::Display;

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum MultiplayerError {
  ExecutableNotFound,
  PortFileNotFound,
  CompressedFileNotFound,
}

impl std::error::Error for MultiplayerError {}
