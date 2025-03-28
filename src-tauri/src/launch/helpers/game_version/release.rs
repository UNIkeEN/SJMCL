// https://minecraft.wiki/w/Version_formats

use super::misc::{MinecraftVersion, VersionType};
use crate::launch::models::LaunchError;
use lazy_static;
use regex::Regex;
use std::any::Any;
use std::cmp::{Ord, Ordering, PartialOrd};
use std::str::FromStr;

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ReleaseVersion {
  pub major: u32,
  pub minor: u32,
  pub patch: Option<u32>,
  pub rc: Option<u32>,
  pub pre: Option<u32>,
}

impl FromStr for ReleaseVersion {
  type Err = LaunchError;

  fn from_str(s: &str) -> Result<Self, Self::Err> {
    try_parse_full_pre(s)
      .or_else(|| try_parse_rc(s))
      .or_else(|| try_parse_short_pre(s))
      .or_else(|| try_parse_base(s))
      .ok_or(LaunchError::VersionParseError)
  }
}

impl MinecraftVersion for ReleaseVersion {
  fn version_type(&self) -> VersionType {
    VersionType::Release
  }
  fn as_any(&self) -> &dyn Any {
    self
  }
  fn to_version_string(&self) -> String {
    let mut base = format!("{}.{}", self.major, self.minor);
    if let Some(patch) = self.patch {
      base.push_str(&format!(".{}", patch));
    }
    if let Some(rc) = self.rc {
      base.push_str(&format!("-rc{}", rc));
    }
    if let Some(pre) = self.pre {
      if self.major == 1 && self.minor == 14 {
        match self.patch {
          None | Some(1) | Some(2) => base.push_str(&format!(" Pre-Release {}", pre)),
          _ => base.push_str(&format!("-pre{}", pre)),
        }
      }
    }
    base
  }

  fn dynamic_cmp(&self, other: &dyn MinecraftVersion) -> Option<Ordering> {
    if let Some(type_order) = self.version_type().partial_cmp(&other.version_type()) {
      if type_order != Ordering::Equal {
        Some(type_order);
      }
      Some(self.cmp(other.as_any().downcast_ref::<ReleaseVersion>().unwrap()))
    } else {
      None // TODO: lookup table
    }
  }
}

fn try_parse_full_pre(s: &str) -> Option<ReleaseVersion> {
  lazy_static::lazy_static!(
    static ref RE: Regex = Regex::new(
        r"^(?P<major>\d+)\.(?P<minor>\d+)(?:\.(?P<patch>\d+))?\s+Pre-Release\s+(?P<pre>\d+)$"
    ).unwrap();
  );
  RE.captures(s).and_then(|c| {
    parse_base(&c).and_then(|mut v| {
      v.pre = parse_optional(&c, "pre");
      Some(v)
    })
  })
}

fn try_parse_rc(s: &str) -> Option<ReleaseVersion> {
  lazy_static::lazy_static! {
      static ref RE: Regex = Regex::new(
          r"^(?P<major>\d+)\.(?P<minor>\d+)(?:\.(?P<patch>\d+))?-rc(?P<rc>\d+)$"
      ).unwrap();
  }
  RE.captures(s).and_then(|c| {
    parse_base(&c).and_then(|mut v| {
      v.rc = parse_optional(&c, "rc");
      Some(v)
    })
  })
}

fn try_parse_short_pre(s: &str) -> Option<ReleaseVersion> {
  lazy_static::lazy_static! {
      static ref RE: Regex = Regex::new(
          r"^(?P<major>\d+)\.(?P<minor>\d+)(?:\.(?P<patch>\d+))?-pre(?P<pre>\d+)$"
      ).unwrap();
  }
  RE.captures(s).and_then(|c| {
    parse_base(&c).and_then(|mut v| {
      v.pre = parse_optional(&c, "pre");
      Some(v)
    })
  })
}

fn try_parse_base(s: &str) -> Option<ReleaseVersion> {
  lazy_static::lazy_static! {
      static ref RE: Regex = Regex::new(
          r"^(?P<major>\d+)\.(?P<minor>\d+)(?:\.(?P<patch>\d+))?$"
      ).unwrap();
  }
  RE.captures(s).and_then(|c| parse_base(&c))
}

fn parse_base(c: &regex::Captures) -> Option<ReleaseVersion> {
  Some(ReleaseVersion {
    major: parse_num(&c, "major")?,
    minor: parse_num(&c, "minor")?,
    patch: parse_optional(&c, "patch"),
    rc: None,
    pre: None,
  })
}

fn parse_num(c: &regex::Captures, name: &str) -> Option<u32> {
  c.name(name)?.as_str().parse().ok()
}

fn parse_optional(c: &regex::Captures, name: &str) -> Option<u32> {
  c.name(name).and_then(|m| m.as_str().parse().ok())
}
