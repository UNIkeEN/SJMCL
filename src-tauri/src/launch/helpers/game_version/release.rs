// https://minecraft.wiki/w/Version_formats

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ReleaseVersion {
  pub major: u32,
  pub minor: u32,
  pub patch: Option<u32>,
  pub rc: Option<u32>,
  pub pre: Option<char>,
}
