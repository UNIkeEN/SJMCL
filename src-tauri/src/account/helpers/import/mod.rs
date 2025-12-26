pub mod hmcl;

use serde::Deserialize;

// other launchers we support import accounts from
#[allow(clippy::upper_case_acronyms)]
#[derive(Debug, Clone, Deserialize)]
pub enum ImportLauncherType {
  HMCL,
  PCL, // only on Windows
  SCL, // only on macOS
}
