use super::constants::SCOPE;
use crate::account::helpers::authlib_injector::{common::parse_profile, models::MinecraftProfile};
use crate::account::helpers::misc::{OAuthCode, OAuthTokens};
use crate::account::models::{AccountError, AccountInfo, OAuthCodeResponse, PlayerInfo};
use crate::error::SJMCLResult;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde_json::Value;
use std::sync::Mutex;
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

  let response = client
    .post(device_authorization_endpoint)
    .form(&[("client_id", client_id), ("scope", SCOPE.to_string())])
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?
    .json::<OAuthCode>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  let device_code = response.device_code;
  let user_code = response.user_code;
  let verification_uri = response
    .verification_uri_complete
    .unwrap_or(response.verification_uri);
  let interval = response.interval;

  app.clipboard().write_text(user_code.clone())?;

  Ok(OAuthCodeResponse {
    device_code,
    user_code,
    verification_uri,
    interval,
  })
}

async fn parse_token(
  app: &AppHandle,
  jwks: Value,
  tokens: &OAuthTokens,
  auth_server_url: Option<String>,
  client_id: String,
) -> SJMCLResult<PlayerInfo> {
  let key = &jwks["keys"].as_array().ok_or(AccountError::ParseError)?[0];

  let e = key["e"].as_str().unwrap_or_default();
  let n = key["n"].as_str().unwrap_or_default();

  let decoding_key =
    DecodingKey::from_rsa_components(n, e).map_err(|_| AccountError::ParseError)?;

  let mut validation = Validation::new(Algorithm::RS256);
  validation.set_audience(&[client_id]);

  let token_data = decode::<Value>(
    tokens.id_token.clone().unwrap_or_default().as_str(),
    &decoding_key,
    &validation,
  )
  .map_err(|_| AccountError::ParseError)?;

  let selected_profile =
    serde_json::from_value::<MinecraftProfile>(token_data.claims["selectedProfile"].clone())
      .map_err(|_| AccountError::ParseError)?;

  parse_profile(
    app,
    &selected_profile,
    Some(tokens.access_token.clone()),
    Some(tokens.refresh_token.clone()),
    auth_server_url,
    Some(selected_profile.name.clone()),
    None,
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
  let account_binding = app.state::<Mutex<AccountInfo>>();

  {
    let mut account_state = account_binding.lock()?;
    account_state.is_oauth_processing = true;
  }

  let openid_configuration = fetch_openid_configuration(app, openid_configuration_url).await?;

  let token_endpoint = openid_configuration["token_endpoint"]
    .as_str()
    .ok_or(AccountError::ParseError)?;

  let jwks_uri = openid_configuration["jwks_uri"]
    .as_str()
    .ok_or(AccountError::ParseError)?;

  let jwks = fetch_jwks(app, jwks_uri.to_string()).await?;

  let tokens: OAuthTokens;
  loop {
    {
      let account_state = account_binding.lock()?;
      if !account_state.is_oauth_processing {
        return Err(AccountError::Cancelled)?;
      }
    }

    let token_response = client
      .post(token_endpoint)
      .form(&[
        ("client_id", client_id.as_str()),
        ("device_code", auth_info.device_code.as_str()),
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
      ])
      .send()
      .await?;

    if token_response.status().is_success() {
      tokens = token_response
        .json()
        .await
        .map_err(|_| AccountError::ParseError)?;
      break;
    }

    sleep(Duration::from_secs(auth_info.interval)).await;
  }

  parse_token(app, jwks, &tokens, Some(auth_server_url), client_id).await
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

  let tokens: OAuthTokens = token_response
    .json()
    .await
    .map_err(|_| AccountError::ParseError)?;

  parse_token(
    app,
    jwks,
    &tokens,
    player.auth_server_url.clone(),
    client_id,
  )
  .await
}
