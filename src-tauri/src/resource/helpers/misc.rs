use crate::resource::models::{ResourceError, ResourceType, SourceType};
use crate::{error::SJMCLResult, launcher_config::models::LauncherConfig};
use url::Url;

pub fn get_source_priority_list(launcher_config: &LauncherConfig) -> Vec<SourceType> {
  match launcher_config.download.source.strategy.as_str() {
    "official" => vec![SourceType::Official, SourceType::BMCLAPIMirror],
    "mirror" => vec![SourceType::BMCLAPIMirror, SourceType::Official],
    _ => vec![SourceType::BMCLAPIMirror, SourceType::Official],
  }
}

// https://bmclapidoc.bangbang93.com/
pub fn get_download_api(source: SourceType, resource_type: ResourceType) -> SJMCLResult<Url> {
  match source {
      SourceType::Official => match resource_type {
          ResourceType::VersionManifest => Ok(Url::parse("https://launchermeta.mojang.com/mc/game/version_manifest.json")?),
          ResourceType::VersionManifestV2 => Ok(Url::parse("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json")?),
          ResourceType::LauncherMeta => Ok(Url::parse("https://launchermeta.mojang.com/")?),
          ResourceType::Launcher => Ok(Url::parse("https://launcher.mojang.com/")?),
          ResourceType::Assets => Ok(Url::parse("https://resources.download.minecraft.net/")?),
          ResourceType::Libraries => Ok(Url::parse("https://libraries.minecraft.net/")?),
          ResourceType::MojangJava => Ok(Url::parse("https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json")?),
          ResourceType::ForgeMaven => Ok(Url::parse("https://files.minecraftforge.net/maven/")?),
          ResourceType::ForgeMeta => Err(ResourceError::NoDownloadApi.into()), // https://github.com/HMCL-dev/HMCL/pull/3259/files
          ResourceType::Liteloader => Ok(Url::parse("https://dl.liteloader.com/versions/versions.json")?),
          ResourceType::Optifine => Err(ResourceError::NoDownloadApi.into()), // 
          ResourceType::AuthlibInjector => Ok(Url::parse("https://authlib-injector.yushi.moe/")?),
          ResourceType::FabricMeta => Ok(Url::parse("https://meta.fabricmc.net/")?),
          ResourceType::FabricMaven => Ok(Url::parse("https://maven.fabricmc.net/")?),
          // https://github.com/HMCL-dev/HMCL/blob/efd088e014bf1c113f7b3fdf73fb983087ae3f5e/HMCLCore/src/main/java/org/jackhuang/hmcl/download/neoforge/NeoForgeOfficialVersionList.java#L28
          ResourceType::NeoforgeMetaForge => Ok(Url::parse("https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/forge/")?),
          ResourceType::NeoforgeMetaNeoforge => Ok(Url::parse("https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge/")?),
          ResourceType::NeoforgedForge => Ok(Url::parse("https://bmclapi2.bangbang93.com/maven/net/neoforged/forge/")?),
          ResourceType::NeoforgedNeoforge => Ok(Url::parse("https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge/")?),
          ResourceType::QuiltMaven => Ok(Url::parse("https://maven.quiltmc.org/repository/release/")?),
          ResourceType::QuiltMeta => Ok(Url::parse("https://meta.quiltmc.org/")?),
      },
      SourceType::BMCLAPIMirror => match resource_type {
          ResourceType::VersionManifest => Ok(Url::parse("https://bmclapi2.bangbang93.com/mc/game/version_manifest.json")?),
          ResourceType::VersionManifestV2 => Ok(Url::parse("https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json")?),
          ResourceType::LauncherMeta => Ok(Url::parse("https://bmclapi2.bangbang93.com/")?),
          ResourceType::Launcher => Ok(Url::parse("https://bmclapi2.bangbang93.com/")?),
          ResourceType::Assets => Ok(Url::parse("https://bmclapi2.bangbang93.com/assets/")?),
          ResourceType::Libraries => Ok(Url::parse("https://bmclapi2.bangbang93.com/maven/")?),
          ResourceType::MojangJava => Ok(Url::parse("https://bmclapi2.bangbang93.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json")?),
          ResourceType::ForgeMaven => Ok(Url::parse("https://bmclapi2.bangbang93.com/maven/")?),
          ResourceType::ForgeMeta => Ok(Url::parse("https://bmclapi2.bangbang93.com/forge/")?),
          ResourceType::Liteloader => Ok(Url::parse("https://bmclapi.bangbang93.com/maven/com/mumfrey/liteloader/versions.json")?),
          ResourceType::AuthlibInjector => Ok(Url::parse("https://bmclapi2.bangbang93.com/mirrors/authlib-injector/")?),
          ResourceType::FabricMeta => Ok(Url::parse("https://bmclapi2.bangbang93.com/fabric-meta/")?),
          ResourceType::FabricMaven => Ok(Url::parse("https://bmclapi2.bangbang93.com/maven/")?),
          ResourceType::NeoforgeMetaForge | ResourceType::NeoforgeMetaNeoforge => Ok(Url::parse("https://bmclapi2.bangbang93.com/neoforge/")?),
          ResourceType::NeoforgedForge => Ok(Url::parse("https://bmclapi2.bangbang93.com/maven/net/neoforged/forge/")?),
          ResourceType::NeoforgedNeoforge => Ok(Url::parse("https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge/")?),
          ResourceType::Optifine => Err(ResourceError::NoDownloadApi.into()),
          ResourceType::QuiltMaven => Ok(Url::parse("https://bmclapi2.bangbang93.com/maven/")?),
          ResourceType::QuiltMeta => Ok(Url::parse("https://bmclapi2.bangbang93.com/quilt-meta/")?),
      },
  }
}

pub fn convert_url_source_type(
  url: &Url,
  resource_type: &ResourceType,
  src_type: &SourceType,
  dst_type: &SourceType,
) -> SJMCLResult<Url> {
  let url_str = url.as_str();
  let src_api = get_download_api(*src_type, *resource_type)?;
  let dst_api = get_download_api(*dst_type, *resource_type)?;
  if url_str.starts_with(src_api.as_str()) {
    Ok(Url::parse(
      url_str
        .replacen(src_api.as_str(), dst_api.as_str(), 1)
        .as_str(),
    )?)
  } else {
    Err(ResourceError::NoDownloadApi.into())
  }
}
