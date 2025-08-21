use super::constants::{CLIENT_ID, SCOPE, TOKEN_ENDPOINT};
use crate::account::helpers::microsoft::models::{MinecraftProfile, XstsResponse};
use crate::account::helpers::misc::{fetch_image, OAuthCode, OAuthTokens};
use crate::account::helpers::offline::load_preset_skin;
use crate::account::models::{
  AccountError, AccountInfo, OAuthCodeResponse, PlayerInfo, PlayerType, Texture,
};
use crate::error::SJMCLResult;
use serde_json::{json, Value};
use std::str::FromStr;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_http::reqwest;
use tokio::time::{sleep, Duration};
use uuid::Uuid;

pub async fn device_authorization(app: &AppHandle) -> SJMCLResult<OAuthCodeResponse> {
  let client = app.state::<reqwest::Client>();
  let response = client
    .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode")
    .form(&[("client_id", CLIENT_ID), ("scope", SCOPE)])
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

async fn fetch_xbl_token(app: &AppHandle, microsoft_token: String) -> SJMCLResult<String> {
  let client = app.state::<reqwest::Client>();

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

  Ok(response["Token"].as_str().unwrap_or("").to_string())
}

async fn fetch_xsts_token(app: &AppHandle, xbl_token: String) -> SJMCLResult<(String, String)> {
  let client = app.state::<reqwest::Client>();

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
    .json::<XstsResponse>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  let xsts_userhash = response
    .display_claims
    .xui
    .first()
    .map(|xui| xui.uhs.clone())
    .ok_or(AccountError::ParseError)?;

  Ok((xsts_userhash, response.token))
}

async fn fetch_minecraft_token(
  app: &AppHandle,
  xsts_userhash: String,
  xsts_token: String,
) -> SJMCLResult<String> {
  let client = app.state::<reqwest::Client>();

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

  Ok(response["access_token"].as_str().unwrap_or("").to_string())
}

async fn fetch_minecraft_profile(
  app: &AppHandle,
  minecraft_token: String,
) -> SJMCLResult<MinecraftProfile> {
  let client = app.state::<reqwest::Client>();

  let response = client
    .get("https://api.minecraftservices.com/minecraft/profile")
    .header("Authorization", format!("Bearer {}", minecraft_token))
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  Ok(
    response
      .json::<MinecraftProfile>()
      .await
      .map_err(|_| AccountError::NoMinecraftProfile)?,
  )
}

async fn parse_profile(app: &AppHandle, tokens: &OAuthTokens) -> SJMCLResult<PlayerInfo> {
  let xbl_token = fetch_xbl_token(app, tokens.access_token.clone()).await?;
  let (xsts_userhash, xsts_token) = fetch_xsts_token(app, xbl_token).await?;
  let minecraft_token = fetch_minecraft_token(app, xsts_userhash, xsts_token).await?;
  let profile = fetch_minecraft_profile(app, minecraft_token.clone()).await?;

  let mut textures = vec![];
  if let Some(skins) = &profile.skins {
    for skin in skins {
      if skin.state == "ACTIVE" {
        textures.push(Texture {
          texture_type: "SKIN".to_string(),
          image: fetch_image(app, skin.url.clone()).await?,
          model: skin.variant.clone().unwrap_or("default".to_string()),
          preset: None,
        });
      }
    }
  }
  if let Some(capes) = &profile.capes {
    for cape in capes {
      if cape.state == "ACTIVE" {
        textures.push(Texture {
          texture_type: "CAPE".to_string(),
          image: fetch_image(app, cape.url.clone()).await?,
          model: "default".to_string(),
          preset: None,
        });
      }
    }
  }

  if textures.is_empty() {
    // this player didn't have a texture, use preset Steve skin instead
    textures = load_preset_skin(app, "steve".to_string())?;
  }

  Ok(
    PlayerInfo {
      id: "".to_string(),
      uuid: Uuid::from_str(&profile.id).map_err(|_| AccountError::ParseError)?,
      name: profile.name.clone(),
      player_type: PlayerType::Microsoft,
      auth_account: Some(profile.name.clone()),
      access_token: Some(minecraft_token.clone()),
      refresh_token: Some(tokens.refresh_token.clone()),
      textures,
      auth_server_url: None,
      password: None,
    }
    .with_generated_id(),
  )
}

pub async fn login(app: &AppHandle, auth_info: OAuthCodeResponse) -> SJMCLResult<PlayerInfo> {
  let client = app.state::<reqwest::Client>();
  let account_binding = app.state::<Mutex<AccountInfo>>();

  {
    let mut account_state = account_binding.lock()?;
    account_state.is_oauth_processing = true;
  }

  let mut interval = auth_info.interval;
  let tokens: OAuthTokens;

  loop {
    {
      let account_state = account_binding.lock()?;
      if !account_state.is_oauth_processing {
        return Err(AccountError::Cancelled)?;
      }
    }

    let token_response = client
      .post(TOKEN_ENDPOINT)
      .form(&[
        ("client_id", CLIENT_ID),
        ("device_code", &auth_info.device_code),
        ("client_secret", env!("SJMCL_MICROSOFT_CLIENT_SECRET")),
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
      ])
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if token_response.status().is_success() {
      tokens = token_response
        .json()
        .await
        .map_err(|_| AccountError::ParseError)?;
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

  parse_profile(app, &tokens).await
}

pub async fn refresh(app: &AppHandle, player: &PlayerInfo) -> SJMCLResult<PlayerInfo> {
  let client = app.state::<reqwest::Client>();

  let token_response = client
    .post(TOKEN_ENDPOINT)
    .form(&[
      ("client_id", CLIENT_ID),
      (
        "refresh_token",
        player.refresh_token.clone().unwrap_or_default().as_str(),
      ),
      ("grant_type", "refresh_token"),
    ])
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  if !token_response.status().is_success() {
    return Err(AccountError::Expired)?;
  }

  let tokens: OAuthTokens = token_response
    .json()
    .await
    .map_err(|_| AccountError::ParseError)?;

  parse_profile(app, &tokens).await
}

pub async fn validate(app: &AppHandle, player: &PlayerInfo) -> SJMCLResult<bool> {
  let client = app.state::<reqwest::Client>();
  let response = client
    .get("https://api.minecraftservices.com/minecraft/profile")
    .header(
      "Authorization",
      format!("Bearer {}", player.access_token.clone().unwrap_or_default()),
    )
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  Ok(response.status().is_success())
}
