#[derive(serde::Deserialize, Debug)]
pub struct MinecraftProfile {
  pub id: String,
  pub name: String,
  pub skins: Option<Vec<TextureEntry>>,
  pub capes: Option<Vec<TextureEntry>>,
}

#[derive(serde::Deserialize, Debug)]
pub struct TextureEntry {
  pub state: String,
  pub url: String,
  pub variant: Option<String>,
}

structstruck::strike! {
#[strikethrough[derive(serde::Deserialize)]]
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
