use super::models::AuthServer;
use crate::{
  error::{SJMCLError, SJMCLResult},
  storage::Storage,
};
use tauri::command;
use tauri_plugin_http::reqwest;

#[command]
pub fn get_auth_servers() -> SJMCLResult<Vec<AuthServer>> {
  let mut state: Vec<AuthServer> = Storage::load().unwrap_or_default();

  if state.len() == 0 {
    let sjmc_auth_server = AuthServer {
      name: "SJMC 用户中心".to_string(),
      auth_url: "https://skin.mc.sjtu.cn/api/yggdrasil".to_string(),
      mutable: false,
    };
    let mua_auth_server = AuthServer {
      name: "MUA 用户中心".to_string(),
      auth_url: "https://skin.mualliance.ltd/api/yggdrasil".to_string(),
      mutable: false,
    };
    state.push(sjmc_auth_server);
    state.push(mua_auth_server);

    state.save()?;
  }

  Ok(state)
}

#[command]
pub async fn add_auth_server(mut url: String) -> SJMCLResult<String> {
  if !url.starts_with("http://") && !url.starts_with("https://") {
    url = format!("https://{}", url);
  }
  if !url.ends_with("/api/yggdrasil") && !url.ends_with("/api/yggdrasil/") {
    url = format!("{}/api/yggdrasil", url);
  }

  let mut state: Vec<AuthServer> = Storage::load().unwrap_or_default();

  if state.iter().any(|server| server.auth_url == url) {
    return Err(SJMCLError("Auth server already exists".to_string()));
  }
  match reqwest::get(&url).await {
    Ok(response) => {
      let json: serde_json::Value = response
        .json()
        .await
        .map_err(|_| SJMCLError("Failed to parse response".to_string()))?;
      let server_name = json["meta"]["serverName"]
        .as_str()
        .ok_or_else(|| SJMCLError("Invalid response format".to_string()))?
        .to_string();

      state.push(AuthServer {
        name: server_name.clone(),
        auth_url: url,
        mutable: true,
      });

      state.save()?;

      Ok(server_name)
    }
    Err(_) => return Err(SJMCLError("Invalid auth server".to_string())),
  }
}

#[command]
pub fn delete_auth_server(url: String) -> SJMCLResult<()> {
  let mut state: Vec<AuthServer> = Storage::load().unwrap_or_default();
  let initial_len = state.len();
  state.retain(|server| server.auth_url != url || !server.mutable);
  if state.len() == initial_len {
    return Err(SJMCLError(
      "Auth server not found or not mutable".to_string(),
    ));
  }
  state.save()?;
  Ok(())
}
