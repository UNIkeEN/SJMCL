// https://minecraft.wiki/w/Version_formats

use super::misc::{MinecraftVersion, VersionType};
use crate::launch::models::LaunchError;
use lazy_static;
use regex::Regex;
use std::any::Any;
use std::cmp::Ordering;
use std::str::FromStr;

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct AlphaVersion {
  pub major: u32,
  pub minor: u32,
  pub patch: u32,
  pub build: Option<u32>,
  pub v: Option<char>,
}

impl FromStr for AlphaVersion {
  type Err = LaunchError;
  fn from_str(version_str: &str) -> Result<Self, Self::Err> {
    lazy_static::lazy_static! {
        static ref VERSION_REGEX: Regex = Regex::new(r"^a(\d+)\.(\d+)\.(\d+)(?:_(\d{2}))?([a-z])?$").unwrap();
    }
    let map_err = |_| LaunchError::VersionParseError;
    if let Some(captures) = VERSION_REGEX.captures(version_str) {
      let major = captures[1].parse::<u32>().map_err(map_err)?;
      let minor = captures[2].parse::<u32>().map_err(map_err)?;
      let patch = captures[3].parse::<u32>().map_err(map_err)?;
      let build = captures.get(4).map_or(Ok(None), |m| {
        m.as_str().parse::<u32>().map(Some).map_err(map_err)
      })?;
      let v = captures.get(5).map_or(Ok(None), |m| {
        m.as_str()
          .parse::<char>()
          .map(Some)
          .map_err(|_| LaunchError::VersionParseError)
      })?;

      Ok(AlphaVersion {
        major,
        minor,
        patch,
        build,
        v,
      })
    } else {
      Err(LaunchError::VersionParseError)
    }
  }
}

impl MinecraftVersion for AlphaVersion {
  fn version_type(&self) -> VersionType {
    VersionType::Alpha
  }

  fn as_any(&self) -> &dyn Any {
    self
  }

  fn to_version_string(&self) -> String {
    format!(
      "a{}.{}.{}{}{}",
      self.major,
      self.minor,
      self.patch,
      self.build.map(|b| format!("_{:02}", b)).unwrap_or_default(),
      self.v.map(|c| c.to_string()).unwrap_or_default()
    )
  }

  fn dynamic_cmp(&self, other: &dyn MinecraftVersion) -> Option<Ordering> {
    if let Some(type_order) = self.version_type().partial_cmp(&other.version_type()) {
      if type_order != Ordering::Equal {
        Some(type_order)
      } else {
        Some(self.cmp(other.as_any().downcast_ref::<AlphaVersion>().unwrap()))
      }
    } else {
      None
    }
  }
}
