use std::sync::{Arc, Mutex};

use super::constants::{CLIENT_ID, SCOPE};
use crate::account::models::{AccountError, OAuthCodeResponse, PlayerInfo, PlayerType, Texture};
use crate::error::SJMCLResult;
use crate::utils::window::create_webview_window;
use base64::engine::general_purpose;
use base64::Engine;
use serde_json::{json, Value};
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_http::reqwest::{self, Client};
use tokio::time::{sleep, Duration};
use url::Url;
use uuid::Uuid;

include!(concat!(env!("OUT_DIR"), "/secrets.rs"));

pub async fn device_authorization(app: &AppHandle) -> SJMCLResult<OAuthCodeResponse> {
  let client = Client::new();
  let response: Value = client
    .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode")
    .form(&[("client_id", CLIENT_ID), ("scope", SCOPE)])
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?
    .json::<Value>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  let device_code = response["device_code"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();

  let user_code = response["user_code"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();

  app.clipboard().write_text(user_code.clone())?;

  let verification_uri = response["verification_uri"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();

  let interval = response["interval"]
    .as_u64()
    .ok_or(AccountError::ParseError)?;

  Ok(OAuthCodeResponse {
    device_code,
    user_code,
    verification_uri,
    interval,
  })
}

async fn fetch_xbl_token(microsoft_token: String) -> SJMCLResult<String> {
  let client = Client::new();

  let response = client
    .post("https://user.auth.xboxlive.com/user/authenticate")
    .body(
      json!({
        "Properties": {
          "AuthMethod": "RPS",
          "SiteName": "user.auth.xboxlive.com",
          "RpsTicket": format!("d={}", microsoft_token)
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
      })
      .to_string(),
    )
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?
    .json::<Value>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  Ok(
    response["Token"]
      .as_str()
      .ok_or(AccountError::ParseError)?
      .to_string(),
  )
}

async fn fetch_xsts_token(xbl_token: String) -> SJMCLResult<(String, String)> {
  let client = Client::new();

  let response = client
    .post("https://xsts.auth.xboxlive.com/xsts/authorize")
    .body(
      json!({
        "Properties": {
          "SandboxId": "RETAIL",
          "UserTokens": [
            xbl_token
          ]
        },
        "RelyingParty": "rp://api.minecraftservices.com/",
        "TokenType": "JWT"
      })
      .to_string(),
    )
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?
    .json::<Value>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  let xsts_userhash = response["DisplayClaims"]["xui"][0]["uhs"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();

  let xsts_token = response["Token"]
    .as_str()
    .ok_or(AccountError::ParseError)?
    .to_string();

  Ok((xsts_userhash, xsts_token))
}

async fn fetch_minecraft_token(xsts_userhash: String, xsts_token: String) -> SJMCLResult<String> {
  let client = Client::new();

  let response: Value = client
    .post("https://api.minecraftservices.com/authentication/login_with_xbox")
    .json(&serde_json::json!({
      "identityToken": format!("XBL3.0 x={};{}", xsts_userhash, xsts_token),
    }))
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?
    .json::<Value>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  Ok(
    response["access_token"]
      .as_str()
      .ok_or(AccountError::ParseError)?
      .to_string(),
  )
}

async fn parse_profile(
  microsoft_token: String,
  microsoft_refresh_token: String,
) -> SJMCLResult<PlayerInfo> {
  let xbl_token = fetch_xbl_token(microsoft_token).await?;

  let (xsts_userhash, xsts_token) = fetch_xsts_token(xbl_token).await?;

  let minecraft_token = fetch_minecraft_token(xsts_userhash, xsts_token).await?;

  let client = reqwest::Client::new();

  let response = client
    .get("https://api.minecraftservices.com/minecraft/profile")
    .header("Authorization", format!("Bearer {}", minecraft_token))
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?
    .json::<Value>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  let uuid = Uuid::parse_str(response["id"].as_str().unwrap_or_default())
    .map_err(|_| AccountError::ParseError)?;

  let name = response["name"].as_str().unwrap_or_default().to_string();

  let mut textures: Vec<Texture> = vec![];

  const TEXTURE_MAP: [(&str, &str); 2] = [("skins", "SKIN"), ("capes", "CAPE")];

  for (key, val) in TEXTURE_MAP {
    if let Some(skin) = response[key]
      .as_array()
      .ok_or(AccountError::ParseError)?
      .iter()
      .find(|skin| skin["state"] == "ACTIVE")
    {
      let model = skin["variant"].as_str().unwrap_or("default").to_string();
      let img_url = skin["url"].as_str().unwrap_or_default();
      if img_url.is_empty() {
        continue;
      }
      let img_bytes = reqwest::get(img_url).await?.bytes().await?.to_vec();
      let img_base64 = general_purpose::STANDARD.encode(img_bytes);
      textures.push(Texture {
        texture_type: val.to_string(),
        image: img_base64,
        model,
      });
    }
  }

  Ok(PlayerInfo {
    uuid,
    name: name.clone(),
    player_type: PlayerType::Microsoft,
    auth_account: name,
    access_token: minecraft_token,
    textures,
    auth_server_url: "".to_string(),
    password: "".to_string(),
  })
}

pub async fn login(app: &AppHandle, auth_info: OAuthCodeResponse) -> SJMCLResult<PlayerInfo> {
  let client = Client::new();

  let verification_url =
    Url::parse(auth_info.verification_uri.as_str()).map_err(|_| AccountError::ParseError)?;

  let is_cancelled = Arc::new(Mutex::new(false));
  let cancelled_clone = Arc::clone(&is_cancelled);

  let auth_webview = create_webview_window(app, verification_url, 650.0, 500.0, true)
    .await
    .map_err(|_| AccountError::CreateWebviewError)?;

  auth_webview.on_window_event(move |event| {
    if let tauri::WindowEvent::Destroyed = event {
      *cancelled_clone.lock().unwrap() = true;
    }
  });

  let mut interval = auth_info.interval;
  let microsoft_token: String;
  let microsoft_refresh_token: String;

  loop {
    if *is_cancelled.lock().unwrap() {
      return Err(AccountError::Cancelled)?;
    }

    let token_response = client
      .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
      .form(&[
        ("client_id", CLIENT_ID),
        ("device_code", &auth_info.device_code),
        ("client_secret", SJMCL_MICROSOFT_CLIENT_SECRET),
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
      ])
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if token_response.status().is_success() {
      let token_data: Value = token_response
        .json::<Value>()
        .await
        .map_err(|_| AccountError::ParseError)?;

      microsoft_token = token_data["access_token"]
        .as_str()
        .ok_or(AccountError::ParseError)?
        .to_string();

      microsoft_refresh_token = token_data["refresh_token"]
        .as_str()
        .ok_or(AccountError::ParseError)?
        .to_string();

      auth_webview.close()?;
      break;
    } else {
      let error_data = token_response
        .json::<Value>()
        .await
        .map_err(|_| AccountError::ParseError)?;

      let error = error_data["error"]
        .as_str()
        .ok_or(AccountError::ParseError)?;

      match error {
        "authorization_pending" => {}
        "slow_down" => {
          interval *= 2;
        }
        "expired_token" => {
          return Err(AccountError::Expired)?;
        }
        _ => {
          return Err(AccountError::ParseError)?;
        }
      }
    }

    sleep(Duration::from_secs(interval)).await;
  }

  parse_profile(microsoft_token, microsoft_refresh_token).await
}
