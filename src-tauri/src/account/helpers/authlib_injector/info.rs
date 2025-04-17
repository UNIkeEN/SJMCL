use super::constants::CLIENT_IDS;
use crate::account::models::{AccountError, AccountInfo, AuthServerInfo};
use crate::error::SJMCLResult;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use url::Url;

pub async fn fetch_auth_server_info(auth_url: String) -> SJMCLResult<AuthServerInfo> {
  match reqwest::get(&auth_url).await {
    Ok(response) => {
      let json: serde_json::Value = response.json().await.map_err(|_| AccountError::Invalid)?;

      let mut client_id = String::new();

      let openid_configuration_url = json["meta"]["feature.openid_configuration_url"]
        .as_str()
        .unwrap_or_default()
        .to_string();

      if !openid_configuration_url.is_empty() {
        let url = Url::parse(&auth_url).map_err(|_| AccountError::Invalid)?;

        if let Some(domain) = url.domain() {
          client_id = get_client_id(domain.to_string());
        }

        if client_id.is_empty() {
          let response = reqwest::get(&openid_configuration_url).await?;
          let data: serde_json::Value = response.json().await.map_err(|_| AccountError::Invalid)?;
          client_id = data["shared_client_id"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        }
      }

      Ok(AuthServerInfo {
        auth_url: auth_url.clone(),
        client_id,
        metadata: json,
        timestamp: chrono::Utc::now().timestamp_millis() as u64,
      })
    }
    Err(_) => Err(AccountError::Invalid.into()),
  }
}

pub fn get_client_id(domain: String) -> String {
  CLIENT_IDS
    .iter()
    .find(|(first, _)| first == &domain)
    .map(|(_, id)| id)
    .unwrap_or(&"")
    .to_string()
}

pub async fn fetch_auth_url(root: Url) -> SJMCLResult<String> {
  let response = reqwest::get(root.clone())
    .await
    .map_err(|_| AccountError::Invalid)?;

  if let Some(auth_url) = response.headers().get("X-Authlib-Injector-API-Location") {
    let auth_url_str = auth_url.to_str().unwrap_or_default();
    // try to parse auth_url_str as a relative URL and append it to the base URL or return it as is
    let full_url = root
      .join(auth_url_str)
      .map(|url| url.to_string())
      .unwrap_or_else(|_| auth_url_str.to_string());

    Ok(full_url)
  } else {
    Ok(root.to_string())
  }
}

pub async fn refresh_and_update_auth_servers(app: &AppHandle) -> SJMCLResult<()> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  let cloned_account_state = account_binding.lock()?.clone();

  let mut refreshed_auth_server_info_list =
    futures::future::join_all(cloned_account_state.auth_servers.iter().map(|info| async {
      if let Ok(refreshed_info) = fetch_auth_server_info(info.auth_url.clone()).await {
        refreshed_info
      } else {
        info.clone()
      }
    }))
    .await;

  refreshed_auth_server_info_list.retain(|info| !info.metadata.is_null()); // remove invalid servers

  let mut account_state = account_binding.lock()?;
  account_state.auth_servers = refreshed_auth_server_info_list;

  Ok(())
}

pub fn get_auth_server_info_by_url(
  app: &AppHandle,
  auth_url: String,
) -> SJMCLResult<AuthServerInfo> {
  let account_binding = app.state::<Mutex<AccountInfo>>();
  let account_state = account_binding.lock()?;

  account_state
    .auth_servers
    .iter()
    .find(|server| server.auth_url == auth_url)
    .cloned()
    .ok_or(AccountError::NotFound.into())
}
