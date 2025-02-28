// https://minecraft.wiki/w/Version_formats

use crate::launch::models::LaunchError;
use lazy_static;
use regex::Regex;
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
