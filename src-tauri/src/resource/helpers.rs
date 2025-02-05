use crate::{launcher_config::models::LauncherConfig, storage::Storage};

use super::models::ResourceType;

pub fn get_download_api(resource_type: ResourceType) -> String {
  let state: LauncherConfig = Storage::load().unwrap_or_default();
  match state.download.source.strategy.as_str() {
    "official" => match resource_type {
      ResourceType::Game => {
        return "https://launchermeta.mojang.com".to_string();
      }
      ResourceType::Forge => {
        return "https://maven.minecraftforge.net/net/minecraftforge/forge/".to_string();
      }
      ResourceType::Fabric => {
        return "https://meta.fabricmc.net".to_string();
      }
      ResourceType::NeoForge => {
        return "https://maven.neoforged.net/releases/net/neoforged/forge".to_string();
      }
    },
    "mirror" => match resource_type {
      ResourceType::Game => {
        return "https://bmclapi2.bangbang93.com".to_string();
      }
      ResourceType::Forge => {
        return "https://bmclapi2.bangbang93.com/maven/net/minecraftforge/forge/".to_string();
      }
      ResourceType::Fabric => {
        return "https://bmclapi2.bangbang93.com/fabric-meta".to_string();
      }
      ResourceType::NeoForge => {
        return "https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge".to_string();
      }
    },

    _ => {
      // auto mode
      // TODO: try to fetch mirror first, then official
      match resource_type {
        ResourceType::Game => {
          return "https://bmclapi2.bangbang93.com".to_string();
        }
        ResourceType::Forge => {
          return "https://bmclapi2.bangbang93.com/maven/net/minecraftforge/forge/".to_string();
        }
        ResourceType::Fabric => {
          return "https://bmclapi2.bangbang93.com/fabric-meta".to_string();
        }
        ResourceType::NeoForge => {
          return "https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge".to_string();
        }
      }
    }
  }
}
