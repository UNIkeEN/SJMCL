use crate::account::{
  constants::{CLIENT_ID, SCOPE, TEXTURE_TYPES},
  models::{AccountError, PlayerInfo, Texture},
};
use crate::error::SJMCLResult;
use base64::{engine::general_purpose, Engine};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde_json::Value;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, LogicalSize, Size, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_http::reqwest::{self, Client};
use tokio::time::{sleep, Duration};
use uuid::Uuid;

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
    .form(&[("client_id", CLIENT_ID), ("scope", SCOPE)])
    .send()
    .await?
    .json::<Value>()
    .await?;

  Ok((
    response["device_code"].as_str().unwrap().to_string(),
    response["verification_uri_complete"]
      .as_str()
      .unwrap()
      .to_string(),
  ))
}

async fn parse_profile(
  profile: Value,
  access_token: String,
  auth_server_url: String,
) -> SJMCLResult<PlayerInfo> {
  let uuid = Uuid::parse_str(profile["id"].as_str().unwrap_or_default())
    .map_err(|_| AccountError::AuthServerError)?;

  let name = profile["name"].as_str().unwrap_or_default();

  let properties = profile["properties"]
    .as_array()
    .ok_or(AccountError::AuthServerError)?;

  let texture_info_base64 = properties
    .iter()
    .find(|property| property["name"] == "textures")
    .ok_or(AccountError::AuthServerError)?["value"]
    .clone();

  let texture_info = general_purpose::STANDARD
    .decode(texture_info_base64.as_str().unwrap_or_default())
    .map_err(|_| AccountError::AuthServerError)?
    .into_iter()
    .map(|b| b as char)
    .collect::<String>();

  let texture_info_value: Value =
    serde_json::from_str(&texture_info).map_err(|_| AccountError::AuthServerError)?;

  let mut textures: Vec<Texture> = vec![];
  for texture_type in TEXTURE_TYPES {
    if let Some(skin) = texture_info_value["textures"].get(texture_type) {
      let img_url = skin["url"].as_str().unwrap_or_default();
      let img_bytes = reqwest::get(img_url)
        .await
        .map_err(|_| AccountError::AuthServerError)?
        .bytes()
        .await
        .map_err(|_| AccountError::AuthServerError)?;

      textures.push(Texture {
        image: general_purpose::STANDARD.encode(img_bytes),
        texture_type: texture_type.to_string(),
        model: skin["metadata"]
          .get("model")
          .and_then(|model| model.as_str())
          .unwrap_or("default")
          .to_string(),
      });
    }
  }

  if textures.is_empty() {
    return Err(AccountError::TextureError.into());
  }

  Ok(PlayerInfo {
    uuid,
    name: name.to_string(),
    player_type: "3rdparty".to_string(),
    auth_account: name.to_string(),
    access_token,
    textures,
    password: "".to_string(),
    auth_server_url,
  })
}

async fn parse_token(
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
  validation.set_audience(&[CLIENT_ID]);

  let token_data = decode::<Value>(id_token.as_str(), &decoding_key, &validation)
    .map_err(|_| AccountError::AuthServerError)?;

  let selected_profile = token_data
    .claims
    .get("selectedProfile")
    .ok_or(AccountError::AuthServerError)?;

  parse_profile(selected_profile.clone(), access_token, auth_server_url).await
}
pub async fn login(
  app_handle: AppHandle,
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
    WebviewWindowBuilder::new(&app_handle, "", WebviewUrl::External(verification_url))
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
          "client_id": CLIENT_ID,
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

  parse_token(jwks, id_token, access_token, auth_server_url).await
}
