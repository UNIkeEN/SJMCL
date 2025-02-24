use crate::account::models::{AccountError, AuthServer, Features};
use crate::error::SJMCLResult;
use tauri_plugin_http::reqwest;

pub async fn fetch_auth_server(auth_url: String) -> SJMCLResult<AuthServer> {
  match reqwest::get(&auth_url).await {
    Ok(response) => {
      let json: serde_json::Value = response.json().await.map_err(|_| AccountError::Invalid)?;
      let server_name = json["meta"]["serverName"]
        .as_str()
        .ok_or(AccountError::Invalid)?
        .to_string();
      let homepage_url = json["meta"]["links"]["homepage"]
        .as_str()
        .ok_or(AccountError::Invalid)?
        .to_string();
      let register_url = json["meta"]["links"]["register"]
        .as_str()
        .ok_or(AccountError::Invalid)?
        .to_string();
      let non_email_login = json["meta"]["feature.non_email_login"]
        .as_bool()
        .unwrap_or(false);
      let openid_configuration_url = json["meta"]["feature.openid_configuration_url"]
        .as_str()
        .unwrap_or_default()
        .to_string();

      let new_server = AuthServer {
        name: server_name,
        auth_url,
        homepage_url,
        register_url,
        features: Features {
          non_email_login,
          openid_configuration_url,
        },
      };

      Ok(new_server)
    }
    Err(_) => Err(AccountError::Invalid.into()),
  }
}
