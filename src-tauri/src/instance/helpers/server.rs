use crate::error::{SJMCLError, SJMCLResult};
use quartz_nbt::io::Flavor;
use serde::{self, Deserialize, Deserializer, Serialize};
use serde_json::Value;
use std::path::Path;
use tauri_plugin_http::reqwest;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct NbtServerInfo {
  pub ip: String,
  pub icon: Option<String>,
  pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct NbtServersInfo {
  pub servers: Vec<NbtServerInfo>,
}

pub async fn load_servers_info_from_path(path: &Path) -> SJMCLResult<Vec<NbtServerInfo>> {
  if !path.exists() {
    return Ok(Vec::new());
  }
  let bytes = tokio::fs::read(path).await?;
  let (servers_info, _snbt) =
    quartz_nbt::serde::deserialize::<NbtServersInfo>(&bytes, Flavor::Uncompressed)?;
  Ok(servers_info.servers)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SjmcServerQueryResult {
  pub online: bool,
  #[serde(deserialize_with = "deserialize_players")]
  pub players: Option<Players>,
  pub description: Description,
  pub favicon: Option<String>,
}

fn deserialize_players<'de, D>(deserializer: D) -> Result<Option<Players>, D::Error>
where
  D: Deserializer<'de>,
{
  let value = Value::deserialize(deserializer)?;
  match value {
    Value::Bool(false) => Ok(None),
    Value::Object(map) => {
      let players_value = Value::Object(map);
      let players: Players =
        serde_json::from_value(players_value).map_err(serde::de::Error::custom)?;
      Ok(Some(players))
    }
    _ => Err(serde::de::Error::custom(
      "Expected 'players' to be a boolean 'false' or an object",
    )),
  }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Players {
  pub online: u64,
  pub max: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Description {
  pub html: Option<String>,
  pub text: Option<String>,
}

pub async fn query_server_status(server: &String) -> SJMCLResult<SjmcServerQueryResult> {
  // construct request url
  let url = format!("https://mc.sjtu.cn/custom/serverlist/?query={}", server);
  let response = reqwest::get(&url).await?;
  if !response.status().is_success() {
    return Err(SJMCLError(format!("http error: {}", response.status())));
  }
  let query_result: SjmcServerQueryResult = response.json().await?;
  Ok(query_result)
}
