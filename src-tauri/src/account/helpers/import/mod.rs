pub mod hmcl;
pub mod misc;
pub mod multimc;

use serde::Deserialize;

// other launchers we support import accounts from
#[allow(clippy::upper_case_acronyms)]
#[derive(Debug, Clone, Deserialize)]
pub enum ImportLauncherType {
  HMCL,
  SCL, // only on macOS
  MultiMC,
}
