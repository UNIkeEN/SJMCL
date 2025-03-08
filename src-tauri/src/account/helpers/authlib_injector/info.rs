use super::constants::CLIENT_IDS;
use crate::account::models::{AccountError, AuthServer, Features};
use crate::error::SJMCLResult;
use tauri_plugin_http::reqwest;
use url::Url;

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

      let mut client_id = String::new();

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

      let new_server = AuthServer {
        name: server_name,
        auth_url,
        homepage_url,
        register_url,
        features: Features {
          non_email_login,
          openid_configuration_url,
        },
        client_id,
      };

      Ok(new_server)
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
