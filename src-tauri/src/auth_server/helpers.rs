use crate::{storage::Storage, EXE_DIR};

use super::models::AuthServer;
use std::path::PathBuf;

impl Storage for Vec<AuthServer> {
  fn file_path() -> PathBuf {
    EXE_DIR.join("sjmcl.auth_server.json")
  }
}
