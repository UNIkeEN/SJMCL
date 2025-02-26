use super::common::parse_profile;
use crate::account::{
  constants::{SCOPE, SJMC_CLIENT_ID},
  models::{AccountError, PlayerInfo},
};
use crate::error::SJMCLResult;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde_json::Value;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, LogicalSize, Size, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_http::reqwest::{self, Client};
use tokio::time::{sleep, Duration};

async fn fetch_openid_configuration(openid_configuration_url: String) -> SJMCLResult<Value> {
  let res = reqwest::get(&openid_configuration_url)
    .await
    .map_err(|_| AccountError::AuthServerError)?
    .json::<Value>()
    .await
    .map_err(|_| AccountError::AuthServerError)?;

  Ok(res)
}

async fn fetch_jwks(jwks_uri: String) -> SJMCLResult<Value> {
  let res = reqwest::get(&jwks_uri)
    .await
    .map_err(|_| AccountError::AuthServerError)?
    .json::<Value>()
    .await
    .map_err(|_| AccountError::AuthServerError)?;

  Ok(res)
}

async fn device_authorization(
  device_authorization_endpoint: String,
) -> SJMCLResult<(String, String)> {
  let client = Client::new();
  let response: Value = client
    .post(device_authorization_endpoint)
    .form(&[("client_id", SJMC_CLIENT_ID), ("scope", SCOPE)])
    .send()
    .await
    .map_err(|_| AccountError::AuthServerError)?
    .json::<Value>()
    .await
    .map_err(|_| AccountError::AuthServerError)?;

  Ok((
    response["device_code"]
      .as_str()
      .ok_or(AccountError::AuthServerError)?
      .to_string(),
    response["verification_uri_complete"]
      .as_str()
      .ok_or(AccountError::AuthServerError)?
      .to_string(),
  ))
}

async fn parse_token(
  app: AppHandle,
  jwks: Value,
  id_token: String,
  access_token: String,
  auth_server_url: String,
) -> SJMCLResult<PlayerInfo> {
  let key = &jwks["keys"]
    .as_array()
    .ok_or(AccountError::AuthServerError)?[0];

  let e = key["e"].as_str().unwrap_or_default();
  let n = key["n"].as_str().unwrap_or_default();

  let decoding_key =
    DecodingKey::from_rsa_components(n, e).map_err(|_| AccountError::AuthServerError)?;

  let mut validation = Validation::new(Algorithm::RS256);
  validation.set_audience(&[SJMC_CLIENT_ID]);

  let token_data = decode::<Value>(id_token.as_str(), &decoding_key, &validation)
    .map_err(|_| AccountError::AuthServerError)?;

  let selected_profile = token_data.claims["selectedProfile"].clone();

  let auth_account = selected_profile["name"]
    .as_str()
    .ok_or(AccountError::AuthServerError)?
    .to_string();

  parse_profile(
    app,
    selected_profile,
    access_token,
    auth_server_url,
    auth_account,
    "".to_string(),
  )
  .await
}
pub async fn login(
  app: AppHandle,
  auth_server_url: String,
  openid_configuration_url: String,
) -> SJMCLResult<PlayerInfo> {
  let client = Client::new();

  let openid_configuration = fetch_openid_configuration(openid_configuration_url).await?;

  let device_authorization_endpoint = openid_configuration["device_authorization_endpoint"]
    .as_str()
    .ok_or(AccountError::AuthServerError)?;

  let token_endpoint = openid_configuration["token_endpoint"]
    .as_str()
    .ok_or(AccountError::AuthServerError)?;

  let jwks_uri = openid_configuration["jwks_uri"]
    .as_str()
    .ok_or(AccountError::AuthServerError)?;

  let jwks = fetch_jwks(jwks_uri.to_string()).await?;

  let (device_code, verification_uri_complete) =
    device_authorization(device_authorization_endpoint.to_string()).await?;

  let verification_url =
    Url::parse(verification_uri_complete.as_str()).map_err(|_| AccountError::AuthServerError)?;

  let is_cancelled = Arc::new(Mutex::new(false));
  let cancelled_clone = Arc::clone(&is_cancelled);

  let auth_webview_window =
    WebviewWindowBuilder::new(&app, "", WebviewUrl::External(verification_url))
      .title("")
      .build()
      .map_err(|_| AccountError::AuthServerError)?;

  auth_webview_window.set_size(Size::Logical(LogicalSize::new(650.0, 500.0)))?;
  auth_webview_window.center()?;
  auth_webview_window.on_window_event(move |event| {
    if let tauri::WindowEvent::Destroyed = event {
      *cancelled_clone.lock().unwrap() = true;
    }
  });

  let access_token: String;
  let id_token: String;

  loop {
    if *is_cancelled.lock().unwrap() {
      return Err(AccountError::Cancelled)?;
    }

    let token_response = client
      .post(token_endpoint)
      .json(&serde_json::json!({
          "client_id": SJMC_CLIENT_ID,
          "device_code": device_code,
          "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
      }))
      .send()
      .await?;

    if token_response.status().is_success() {
      let token: serde_json::Value = token_response.json().await?;

      access_token = token["access_token"]
        .as_str()
        .ok_or(AccountError::AuthServerError)?
        .to_string();
      id_token = token["id_token"]
        .as_str()
        .ok_or(AccountError::AuthServerError)?
        .to_string();

      auth_webview_window.close()?;
      break;
    }

    sleep(Duration::from_secs(1)).await;
  }

  parse_token(app, jwks, id_token, access_token, auth_server_url).await
}
