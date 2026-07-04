use serde::Deserialize;
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::collections::HashMap;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest::{self, Response, StatusCode};
use uuid::Uuid;

use crate::account::helpers::authlib_injector::common::parse_profile;
use crate::account::helpers::authlib_injector::models::MinecraftProfile;
use crate::account::helpers::microsoft;
use crate::account::helpers::microsoft::constants::{FRIENDS_ENDPOINT, PRESENCE_ENDPOINT};
use crate::account::helpers::microsoft::models::{
  MicrosoftFriend, MicrosoftFriendAction, MicrosoftFriendList, MicrosoftPresenceStatus,
};
use crate::account::helpers::offline::load_preset_skin;
use crate::account::helpers::skin::draw_avatar;
use crate::account::models::{AccountError, PlayerInfo, PresetRole};
use crate::utils::image::ImageWrapper;

const MOJANG_SESSION_SERVER_ENDPOINT: &str = "https://sessionserver.mojang.com";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MicrosoftFriendProfile {
  profile_id: Uuid,
  name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MicrosoftFriendsResponse {
  friends: Vec<MicrosoftFriendProfile>,
  incoming_requests: Vec<MicrosoftFriendProfile>,
  outgoing_requests: Vec<MicrosoftFriendProfile>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MicrosoftFriendActionRequest {
  name: Option<String>,
  profile_id: Option<Uuid>,
  update_type: MicrosoftFriendUpdateType,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum MicrosoftFriendUpdateType {
  Add,
  Remove,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MicrosoftPresenceRequest {
  status: MicrosoftPresenceStatus,
  join_info: Option<MicrosoftJoinInfoUpdate>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MicrosoftJoinInfoUpdate {
  value: Option<String>,
  invites: Option<Vec<Uuid>>,
}

#[derive(Deserialize)]
struct MicrosoftPresenceResponse {
  presence: Vec<MicrosoftPresenceProfile>,
}

#[derive(Deserialize)]
struct MicrosoftFriendsErrorResponse {
  details: Option<MicrosoftFriendsErrorDetails>,
}

#[derive(Deserialize)]
struct MicrosoftFriendsErrorDetails {
  status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MicrosoftPresenceProfile {
  profile_id: Uuid,
  status: MicrosoftPresenceStatus,
  join_info: Option<MicrosoftPresenceJoinInfo>,
  last_updated: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MicrosoftPresenceJoinInfo {
  invited: bool,
}

fn build_friend_action_request(
  tgt_player_name: Option<String>,
  tgt_player_uuid: Option<Uuid>,
  action: MicrosoftFriendAction,
) -> SJMCLResult<MicrosoftFriendActionRequest> {
  let tgt_player_name = tgt_player_name
    .map(|name| name.trim().to_string())
    .filter(|name| !name.is_empty());
  let has_name = tgt_player_name.is_some();
  let has_uuid = tgt_player_uuid.is_some();

  match action {
    MicrosoftFriendAction::Add => {
      if !has_name && !has_uuid {
        return Err(AccountError::Invalid.into());
      }

      Ok(MicrosoftFriendActionRequest {
        name: tgt_player_name,
        profile_id: if has_name { None } else { tgt_player_uuid },
        update_type: MicrosoftFriendUpdateType::Add,
      })
    }
    MicrosoftFriendAction::Remove
    | MicrosoftFriendAction::Decline
    | MicrosoftFriendAction::Revoke => {
      if !has_uuid {
        return Err(AccountError::Invalid.into());
      }

      Ok(MicrosoftFriendActionRequest {
        name: None,
        profile_id: tgt_player_uuid,
        update_type: MicrosoftFriendUpdateType::Remove,
      })
    }
    MicrosoftFriendAction::Accept => {
      if !has_uuid {
        return Err(AccountError::Invalid.into());
      }

      Ok(MicrosoftFriendActionRequest {
        name: None,
        profile_id: tgt_player_uuid,
        update_type: MicrosoftFriendUpdateType::Add,
      })
    }
  }
}

async fn parse_friends_service_error(response: Response) -> SJMCLError {
  if response.status() == StatusCode::BAD_REQUEST {
    let error = response
      .json::<MicrosoftFriendsErrorResponse>()
      .await
      .ok()
      .and_then(|body| body.details.and_then(|details| details.status));

    return match error.as_deref() {
      Some("UNKNOWN_PROFILE") => AccountError::UnknownProfile.into(),
      Some("CANNOT_ADD_SELF") => AccountError::CannotAddSelf.into(),
      Some("DUPLICATED_PROFILES") => AccountError::DuplicatedProfiles.into(),
      _ => AccountError::Invalid.into(),
    };
  }

  match response.status() {
    StatusCode::UNAUTHORIZED => AccountError::Expired.into(),
    StatusCode::FORBIDDEN => AccountError::Forbidden.into(),
    StatusCode::TOO_MANY_REQUESTS => AccountError::TooManyRequests.into(),
    status if status.is_server_error() => AccountError::ServiceUnavailable.into(),
    _ => AccountError::NetworkError.into(),
  }
}

async fn attach_presence(
  app: &AppHandle,
  player: &PlayerInfo,
  friends_response: MicrosoftFriendsResponse,
) -> SJMCLResult<MicrosoftFriendList> {
  let access_token = microsoft::oauth::get_access_token(app, player).await?;
  let client = app.state::<reqwest::Client>();

  let mut presence_map = HashMap::<_, MicrosoftPresenceProfile>::new();
  if !friends_response.friends.is_empty() {
    let response = client
      .post(PRESENCE_ENDPOINT)
      .header("Authorization", format!("Bearer {}", access_token))
      .json(&MicrosoftPresenceRequest {
        status: MicrosoftPresenceStatus::Online,
        join_info: None,
      })
      .send()
      .await
      .map_err(|_| AccountError::NetworkError)?;

    if !response.status().is_success() {
      return Err(parse_friends_service_error(response).await);
    }

    let presence_response = response
      .json::<MicrosoftPresenceResponse>()
      .await
      .map_err(|_| AccountError::ParseError)?;

    presence_map = presence_response
      .presence
      .into_iter()
      .map(|presence| (presence.profile_id, presence))
      .collect();
  }

  let mut friends = Vec::with_capacity(friends_response.friends.len());
  for friend in friends_response.friends {
    friends.push(MicrosoftFriend {
      avatar: retrieve_friend_avatar(app, &friend).await?,
      profile_id: friend.profile_id,
      name: friend.name,
      status: presence_map
        .get(&friend.profile_id)
        .map(|presence| presence.status.clone()),
      invited: presence_map.get(&friend.profile_id).and_then(|presence| {
        presence
          .join_info
          .as_ref()
          .map(|join_info| join_info.invited)
      }),
      last_updated: presence_map
        .remove(&friend.profile_id)
        .map(|presence| presence.last_updated),
    });
  }

  let mut incoming_requests = Vec::with_capacity(friends_response.incoming_requests.len());
  for friend in friends_response.incoming_requests {
    incoming_requests.push(MicrosoftFriend {
      avatar: retrieve_friend_avatar(app, &friend).await?,
      profile_id: friend.profile_id,
      name: friend.name,
      status: None,
      invited: None,
      last_updated: None,
    });
  }

  let mut outgoing_requests = Vec::with_capacity(friends_response.outgoing_requests.len());
  for friend in friends_response.outgoing_requests {
    outgoing_requests.push(MicrosoftFriend {
      avatar: retrieve_friend_avatar(app, &friend).await?,
      profile_id: friend.profile_id,
      name: friend.name,
      status: None,
      invited: None,
      last_updated: None,
    });
  }

  Ok(MicrosoftFriendList {
    friends,
    incoming_requests,
    outgoing_requests,
  })
}

async fn retrieve_friend_avatar(
  app: &AppHandle,
  friend: &MicrosoftFriendProfile,
) -> SJMCLResult<Vec<ImageWrapper>> {
  let client = app.state::<reqwest::Client>();
  let profile = client
    .get(format!(
      "{}/session/minecraft/profile/{}",
      MOJANG_SESSION_SERVER_ENDPOINT,
      friend.profile_id.simple()
    ))
    .send()
    .await;

  if let Ok(response) = profile
    && response.status().is_success()
    && let Ok(profile) = response.json::<MinecraftProfile>().await
    && let Ok(player_info) = parse_profile(app, &profile, None, None, None, None).await
    && let Some(texture) = player_info.textures.first()
  {
    return Ok(draw_avatar(36, &texture.image.image));
  }

  let preset_skin = load_preset_skin(app, PresetRole::Steve)?;
  Ok(draw_avatar(36, &preset_skin[0].image.image))
}

pub async fn retrieve_friend_list(
  app: &AppHandle,
  player: &PlayerInfo,
) -> SJMCLResult<MicrosoftFriendList> {
  let access_token = microsoft::oauth::get_access_token(app, player).await?;
  let client = app.state::<reqwest::Client>();

  let response = client
    .get(FRIENDS_ENDPOINT)
    .header("Authorization", format!("Bearer {}", access_token))
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  if !response.status().is_success() {
    return Err(parse_friends_service_error(response).await);
  }

  let friends_response = response
    .json::<MicrosoftFriendsResponse>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  attach_presence(app, player, friends_response).await
}

pub async fn update_friend(
  app: &AppHandle,
  player: &PlayerInfo,
  tgt_player_name: Option<String>,
  tgt_player_uuid: Option<Uuid>,
  action: MicrosoftFriendAction,
) -> SJMCLResult<MicrosoftFriendList> {
  let access_token = microsoft::oauth::get_access_token(app, player).await?;
  let client = app.state::<reqwest::Client>();
  let request = build_friend_action_request(tgt_player_name, tgt_player_uuid, action)?;

  let response = client
    .put(FRIENDS_ENDPOINT)
    .header("Authorization", format!("Bearer {}", access_token))
    .json(&request)
    .send()
    .await
    .map_err(|_| AccountError::NetworkError)?;

  if !response.status().is_success() {
    return Err(parse_friends_service_error(response).await);
  }

  let friends_response = response
    .json::<MicrosoftFriendsResponse>()
    .await
    .map_err(|_| AccountError::ParseError)?;

  attach_presence(app, player, friends_response).await
}
