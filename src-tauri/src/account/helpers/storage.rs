use super::super::models::AccountInfo;
use crate::{storage::Storage, EXE_DIR};
use std::path::PathBuf;

impl Storage for AccountInfo {
  fn file_path() -> PathBuf {
    EXE_DIR.join("sjmcl.account.json")
  }
}
