use tauri_plugin_http::reqwest;

use crate::{
  error::{SJMCLError, SJMCLResult},
  storage::Storage,
  EXE_DIR,
};

use super::models::{AccountInfo, AuthServer, AuthServerError};
use std::path::PathBuf;

impl Storage for AccountInfo {
  fn file_path() -> PathBuf {
    EXE_DIR.join("sjmcl.account.json")
  }
}

pub async fn fetch_auth_server(auth_url: String) -> SJMCLResult<AuthServer> {
  match reqwest::get(&auth_url).await {
    Ok(response) => {
      let json: serde_json::Value = response
        .json()
        .await
        .map_err(|_| SJMCLError(AuthServerError::InvalidServer.to_string()))?;
      let server_name = json["meta"]["serverName"]
        .as_str()
        .ok_or_else(|| SJMCLError(AuthServerError::InvalidServer.to_string()))?
        .to_string();
      let homepage_url = json["meta"]["links"]["homepage"]
        .as_str()
        .ok_or_else(|| SJMCLError(AuthServerError::InvalidServer.to_string()))?
        .to_string();
      let register_url = json["meta"]["links"]["register"]
        .as_str()
        .ok_or_else(|| SJMCLError(AuthServerError::InvalidServer.to_string()))?
        .to_string();

      let new_server = AuthServer {
        name: server_name,
        auth_url,
        homepage_url,
        register_url,
      };

      Ok(new_server)
    }
    Err(_) => Err(SJMCLError(AuthServerError::InvalidServer.to_string())),
  }
}
