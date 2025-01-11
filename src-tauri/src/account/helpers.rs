use crate::{storage::Storage, EXE_DIR};

use super::models::PlayerInfo;
use std::path::PathBuf;

impl Storage for Vec<PlayerInfo> {
  fn file_path() -> PathBuf {
    EXE_DIR.join("sjmcl.account.json")
  }
}
