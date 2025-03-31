use super::alpha::AlphaVersion;
use super::beta::BetaVersion;
use crate::error::SJMCLResult;
use crate::launch::models::LaunchError;
use std::any::Any;
use std::cmp::Ordering;
use std::fmt::Debug;
use std::str::FromStr;

#[derive(PartialEq, Eq, Debug)]
pub enum VersionType {
  PreClassic,
  Classic,
  InfDev,
  Alpha,
  Beta,
  Release,
  Snapshot,
  AprilFool,
}

impl VersionType {
  fn rank(&self) -> Option<u8> {
    match self {
      VersionType::PreClassic => Some(0),
      VersionType::Classic => Some(1),
      VersionType::InfDev => Some(2),
      VersionType::Alpha => Some(3),
      VersionType::Beta => Some(4),
      _ => None,
    }
  }
}

impl PartialOrd for VersionType {
  fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
    match (self.rank(), other.rank()) {
      (Some(a), Some(b)) => a.partial_cmp(&b),
      (Some(_), None) => Some(Ordering::Less),
      (None, Some(_)) => Some(Ordering::Greater),
      (None, None) => {
        if self == other {
          Some(Ordering::Equal)
        } else {
          None
        }
      }
    }
  }
}

pub trait MinecraftVersion: Debug + Any + 'static {
  fn version_type(&self) -> VersionType;
  fn as_any(&self) -> &dyn Any;
  fn to_version_string(&self) -> String;
  fn dynamic_cmp(&self, other: &dyn MinecraftVersion) -> Option<Ordering>;
}

pub fn parse_version(s: &str) -> SJMCLResult<Box<dyn MinecraftVersion>> {
  if let Ok(alpha) = AlphaVersion::from_str(s) {
    return Ok(Box::new(alpha));
  }
  if let Ok(beta) = BetaVersion::from_str(s) {
    return Ok(Box::new(beta));
  }

  // 其他版本解析逻辑...

  Err(LaunchError::VersionParseError.into())
}
