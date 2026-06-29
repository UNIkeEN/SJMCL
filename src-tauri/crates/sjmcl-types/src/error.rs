use serde::Serialize;
use std::error::Error;

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct SJMCLError(pub String);

pub type SJMCLResult<T> = Result<T, SJMCLError>;

impl<T> From<T> for SJMCLError
where
  T: Error,
{
  fn from(err: T) -> Self {
    SJMCLError(err.to_string())
  }
}
