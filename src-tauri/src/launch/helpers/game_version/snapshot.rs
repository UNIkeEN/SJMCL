use super::misc::{MinecraftVersion, VersionType};
use crate::error::{SJMCLError, SJMCLResult};
use crate::launch::models::LaunchError;
use lazy_static::lazy_static;
use regex::Regex;
use std::any::Any;
use std::cmp::Ordering;
use std::str::FromStr;

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct SnapshotVersion {
  pub year: u32,    // 年份后两位，如 16 表示 2016
  pub week: u32,    // 周数 (1-53)
  pub suffix: char, // 后缀字母 (a-z)
}

impl FromStr for SnapshotVersion {
  type Err = SJMCLError;

  fn from_str(s: &str) -> SJMCLResult<Self> {
    lazy_static! {
      static ref RE: Regex =
        Regex::new(r"^(?P<year>\d{2})w(?P<week>\d{2})(?P<suffix>[a-z])$").unwrap();
    }

    let captures = RE.captures(s).ok_or(LaunchError::VersionParseError)?;

    Ok(SnapshotVersion {
      year: parse_field(&captures, "year")?,
      week: parse_field(&captures, "week")?,
      suffix: parse_char(&captures, "suffix")?,
    })
  }
}

// 辅助函数：解析数值字段
fn parse_field(captures: &regex::Captures, name: &str) -> Result<u32, LaunchError> {
  captures
    .name(name)
    .ok_or(LaunchError::VersionParseError)?
    .as_str()
    .parse()
    .map_err(|_| LaunchError::VersionParseError)
}

// 辅助函数：解析字符字段
fn parse_char(captures: &regex::Captures, name: &str) -> Result<char, LaunchError> {
  captures
    .name(name)
    .ok_or(LaunchError::VersionParseError)?
    .as_str()
    .chars()
    .next()
    .ok_or(LaunchError::VersionParseError)
}

impl MinecraftVersion for SnapshotVersion {
  fn version_type(&self) -> VersionType {
    VersionType::Snapshot
  }

  fn as_any(&self) -> &dyn Any {
    self
  }

  fn to_version_string(&self) -> String {
    format!("{:02}w{:02}{}", self.year, self.week, self.suffix)
  }

  fn dynamic_cmp(&self, other: &dyn MinecraftVersion) -> Option<Ordering> {
    if let Some(type_order) = self.version_type().partial_cmp(&other.version_type()) {
      if type_order != Ordering::Equal {
        Some(type_order)
      } else {
        Some(self.cmp(other.as_any().downcast_ref::<&SnapshotVersion>().unwrap()))
      }
    } else {
      None // TODO: lookup table
    }
  }
}
