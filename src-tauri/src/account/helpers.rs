use crate::{storage::Storage, EXE_DIR};

use super::models::AccountInfo;
use std::path::PathBuf;

impl Storage for AccountInfo {
  fn file_path() -> PathBuf {
    EXE_DIR.join("sjmcl.account.json")
  }
}
