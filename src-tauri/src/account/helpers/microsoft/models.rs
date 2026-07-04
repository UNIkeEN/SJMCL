use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};
use uuid::Uuid;

use crate::account::models::SkinModel;
use crate::utils::image::ImageWrapper;

#[derive(Deserialize, Debug)]
pub struct MinecraftProfile {
  pub id: String,
  pub name: String,
  pub skins: Option<Vec<TextureEntry>>,
  pub capes: Option<Vec<TextureEntry>>,
}

#[derive(Deserialize, Debug)]
pub struct TextureEntry {
  pub state: String,
  pub url: String,
  pub variant: Option<SkinModel>,
}

structstruck::strike! {
#[strikethrough[derive(Deserialize)]]
  pub struct XstsResponse {
    #[serde(rename = "Token")]
    pub token: String,
    #[serde(rename = "DisplayClaims")]
    pub display_claims: pub struct {
      pub xui: Vec<pub struct {
        pub uhs: String,
      }>,
    },
  }
}

#[derive(Deserialize, Debug)]
pub struct XstsErrorResponse {
  #[serde(rename = "XErr")]
  pub x_err: i64,
}

#[derive(Debug, PartialEq, Eq, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MicrosoftFriend {
  pub profile_id: Uuid,
  pub name: String,
  pub avatar: Vec<ImageWrapper>,
  pub status: Option<MicrosoftPresenceStatus>,
  pub invited: Option<bool>,
  pub last_updated: Option<String>,
}

#[derive(Debug, PartialEq, Eq, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MicrosoftFriendList {
  pub friends: Vec<MicrosoftFriend>,
  pub incoming_requests: Vec<MicrosoftFriend>,
  pub outgoing_requests: Vec<MicrosoftFriend>,
}

#[derive(Debug, PartialEq, Eq, Clone, Serialize, Deserialize, Display, EnumString)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum MicrosoftFriendAction {
  Add,
  Remove,
  Accept,
  Decline,
  Revoke,
}

#[derive(Debug, PartialEq, Eq, Clone, Serialize, Deserialize, Display, EnumString)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum MicrosoftPresenceStatus {
  Online,
  PlayingOffline,
  PlayingRealms,
  PlayingServer,
  PlayingHostedServer,
  Offline,
}
