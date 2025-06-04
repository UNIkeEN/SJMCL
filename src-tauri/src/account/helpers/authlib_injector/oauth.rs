use super::common::parse_profile;
use super::constants::SCOPE;
use crate::account::models::{AccountError, OAuthCodeResponse, PlayerInfo};
use crate::error::SJMCLResult;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_http::reqwest;
use tokio::time::{sleep, Duration};

async fn fetch_openid_configuration(
  app: &AppHandle,
  openid_configuration_url: String,
) -> SJMCLResult<Value> {
  let client = app.state::<reqwest::Client>();

  let res = client
    .get(&openid_configuration_url)
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?
    .json::<Value>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  Ok(res)
}

async fn fetch_jwks(app: &AppHandle, jwks_uri: String) -> SJMCLResult<Value> {
  let client = app.state::<reqwest::Client>();

  let res = client
    .get(&jwks_uri)
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?
    .json::<Value>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  Ok(res)
}

pub async fn device_authorization(
  app: &AppHandle,
  openid_configuration_url: String,
  client_id: String,
) -> SJMCLResult<OAuthCodeResponse> {
  let client = app.state::<reqwest::Client>();

  let openid_configuration = fetch_openid_configuration(app, openid_configuration_url).await?;

  let device_authorization_endpoint = openid_configuration["device_authorization_endpoint"]
    .as_str()
    .ok_or(AccountError::ParseError)?;

  let response: Value = client
    .post(device_authorization_endpoint)
    .form(&[("client_id", client_id), ("scope", SCOPE.to_string())])
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?
    .json::<Value>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  let user_code = response["user_code"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();

  let device_code = response["device_code"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();

  app.clipboard().write_text(user_code.clone())?;

  let verification_uri = response["verification_uri_complete"]
    .as_str()
    .unwrap_or(
      response["verification_uri"]
        .as_str()
        .ok_or(AccountError::ParseError)?,
    )
    .to_string();

  let interval = response["interval"]
    .as_u64()
    .ok_or(AccountError::ParseError)?;

  Ok(OAuthCodeResponse {
    user_code,
    device_code,
    verification_uri,
    interval,
  })
}

async fn parse_token(
  app: &AppHandle,
  jwks: Value,
  id_token: String,
  access_token: String,
  refresh_token: String,
  auth_server_url: String,
  client_id: String,
) -> SJMCLResult<PlayerInfo> {
  let key = &jwks["keys"].as_array().ok_or(AccountError::ParseError)?[0];

  let e = key["e"].as_str().unwrap_or_default();
  let n = key["n"].as_str().unwrap_or_default();

  let decoding_key =
    DecodingKey::from_rsa_components(n, e).map_err(|_| AccountError::ParseError)?;

  let mut validation = Validation::new(Algorithm::RS256);
  validation.set_audience(&[client_id]);

  let token_data = decode::<Value>(id_token.as_str(), &decoding_key, &validation)
    .map_err(|_| AccountError::ParseError)?;

  let selected_profile = token_data.claims["selectedProfile"].clone();

  let auth_account = selected_profile["name"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();

  parse_profile(
    app,
    selected_profile,
    access_token,
    refresh_token,
    auth_server_url,
    auth_account,
    "".to_string(),
  )
  .await
}

pub async fn login(
  app: &AppHandle,
  auth_server_url: String,
  openid_configuration_url: String,
  client_id: String,
  auth_info: OAuthCodeResponse,
) -> SJMCLResult<PlayerInfo> {
  let client = app.state::<reqwest::Client>();

  let openid_configuration = fetch_openid_configuration(app, openid_configuration_url).await?;

  let token_endpoint = openid_configuration["token_endpoint"]
    .as_str()
    .ok_or(AccountError::ParseError)?;

  let jwks_uri = openid_configuration["jwks_uri"]
    .as_str()
    .ok_or(AccountError::ParseError)?;

  let jwks = fetch_jwks(app, jwks_uri.to_string()).await?;

  let access_token: String;
  let id_token: String;
  let refresh_token: String;

  loop {
    let token_response = client
      .post(token_endpoint)
      .json(&serde_json::json!({
          "client_id": client_id,
          "device_code": auth_info.device_code,
          "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
      }))
      .send()
      .await?;

    if token_response.status().is_success() {
      let token: serde_json::Value = token_response.json().await?;

      access_token = token["access_token"]
        .as_str()
        .ok_or(AccountError::ParseError)?
        .to_string();
      id_token = token["id_token"]
        .as_str()
        .ok_or(AccountError::ParseError)?
        .to_string();
      refresh_token = token["refresh_token"]
        .as_str()
        .ok_or(AccountError::ParseError)?
        .to_string();
      break;
    }

    sleep(Duration::from_secs(auth_info.interval)).await;
  }

  parse_token(
    app,
    jwks,
    id_token,
    access_token,
    refresh_token,
    auth_server_url,
    client_id,
  )
  .await
}

pub async fn refresh(
  app: &AppHandle,
  player: &PlayerInfo,
  client_id: String,
  openid_configuration_url: String,
) -> SJMCLResult<PlayerInfo> {
  let openid_configuration = fetch_openid_configuration(app, openid_configuration_url).await?;

  let token_endpoint = openid_configuration["token_endpoint"]
    .as_str()
    .ok_or(AccountError::ParseError)?;

  let jwks_uri = openid_configuration["jwks_uri"]
    .as_str()
    .ok_or(AccountError::ParseError)?;

  let jwks = fetch_jwks(app, jwks_uri.to_string()).await?;

  let client = app.state::<reqwest::Client>();

  let token_response = client
    .post(token_endpoint)
    .json(&serde_json::json!({
      "client_id": client_id,
      "refresh_token": player.refresh_token,
      "grant_type": "refresh_token",
    }))
    .send()
    .await?;
  if !token_response.status().is_success() {
    return Err(AccountError::Expired)?;
  }
  let token: serde_json::Value = token_response.json().await?;

  let access_token = token["access_token"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();
  let id_token = token["id_token"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();
  let refresh_token = token["refresh_token"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();

  parse_token(
    app,
    jwks,
    id_token,
    access_token,
    refresh_token,
    player.auth_server_url.clone(),
    client_id,
  )
  .await
}
