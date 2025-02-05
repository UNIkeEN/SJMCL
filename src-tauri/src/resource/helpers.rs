use crate::{error::SJMCLResult, launcher_config::models::LauncherConfig, storage::Storage};

use super::models::{ResourceError, ResourceType};

pub fn get_source_priority_list() -> Vec<String> {
  let state: LauncherConfig = Storage::load().unwrap_or_default();
  match state.download.source.strategy.as_str() {
    "official" => vec!["official".to_string(), "mirror".to_string()],
    "mirror" => vec!["mirror".to_string(), "official".to_string()],
    _ => vec!["mirror".to_string(), "official".to_string()],
  }
}

pub async fn get_download_api(source: String, resource_type: ResourceType) -> SJMCLResult<String> {
  match source.as_str() {
    "official" => match resource_type {
      ResourceType::Game => Ok("https://launchermeta.mojang.com".to_string()),
      ResourceType::Fabric => Ok("https://meta.fabricmc.net".to_string()),
      ResourceType::Forge => {
        Ok("https://maven.minecraftforge.net/net/minecraftforge/forge/".to_string())
      }
      ResourceType::NeoForge => {
        Ok("https://maven.neoforged.net/releases/net/neoforged/forge".to_string())
      }
    },
    "mirror" => match resource_type {
      ResourceType::Game => Ok("https://bmclapi2.bangbang93.com".to_string()),
      ResourceType::Fabric => Ok("https://bmclapi2.bangbang93.com/fabric-meta".to_string()),
      ResourceType::Forge => {
        Ok("https://bmclapi2.bangbang93.com/maven/net/minecraftforge/forge/".to_string())
      }
      ResourceType::NeoForge => {
        Ok("https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge".to_string())
      }
    },
    _ => Err(ResourceError::NoDownloadApi.into()),
  }
}
