use std::collections::HashMap;

structstruck::strike! {
  #[strikethrough[derive(serde::Deserialize, serde::Serialize)]]
  pub struct MinecraftProfile {
    pub id: String,
    pub name: String,
    pub properties: Option<Vec<pub struct {
      pub name: String,
      pub value: String,
    }>>
  }
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
