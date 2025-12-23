use std::collections::HashMap;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct MinecraftProfileProperty {
  pub name: String,
  pub value: String,
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct MinecraftProfile {
  pub id: String,
  pub name: String,
  pub properties: Option<Vec<MinecraftProfileProperty>>,
}

structstruck::strike! {
  #[strikethrough[derive(serde::Deserialize, serde::Serialize)]]
  pub struct TextureInfo {
    pub textures: HashMap<String, pub struct {
      pub url: String,
      pub metadata: Option<HashMap<String, String>>,
    }>
  }
}
