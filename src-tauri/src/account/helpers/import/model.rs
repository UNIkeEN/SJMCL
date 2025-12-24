use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub enum ImportLauncherType {
  HMCL,
  PCL,
}

#[derive(Debug, Clone, Deserialize)]
pub struct HmclOfflineAccount {
  pub uuid: String,
  pub username: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HmclMicrosoftAccount {
  pub uuid: String,
  pub display_name: String,
  pub token_type: String,
  pub access_token: String,
  pub refresh_token: String,
  pub not_after: i64,
  pub userid: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct HmclProfileProperties {
  pub textures: Option<String>,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HmclThirdPartyAccount {
  #[serde(rename = "serverBaseURL")]
  pub server_base_url: String,
  pub client_token: String,
  pub display_name: String,
  pub access_token: String,
  pub profile_properties: HmclProfileProperties,
  pub uuid: String,
  pub username: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum HmclAccountEntry {
  #[serde(rename = "offline")]
  Offline(HmclOfflineAccount),
  #[serde(rename = "microsoft")]
  Microsoft(HmclMicrosoftAccount),
  #[serde(rename = "authlibInjector")]
  ThirdParty(HmclThirdPartyAccount),
}
