use crate::resource::helpers::curseforge::misc::translate_description_curseforge;
use crate::resource::helpers::mod_db::ModDataBase;
use crate::resource::helpers::modrinth::misc::translate_description_modrinth;
use crate::resource::models::{
  OtherResourceInfo, OtherResourceSource, OtherResourceVersionPack, ResourceError, ResourceType,
  SourceType,
};
use crate::{error::SJMCLResult, launcher_config::models::LauncherConfig};
use std::cmp::Ordering;
use std::sync::Mutex;
use strum::IntoEnumIterator;
use tauri::{AppHandle, Manager};
use url::Url;

pub fn get_source_priority_list(launcher_config: &LauncherConfig) -> Vec<SourceType> {
  match launcher_config.download.source.strategy.as_str() {
    "official" => vec![SourceType::Official, SourceType::BMCLAPIMirror],
    "mirror" => vec![SourceType::BMCLAPIMirror, SourceType::Official],
    "auto" => match launcher_config.basic_info.is_china_mainland_ip {
      true => vec![SourceType::BMCLAPIMirror, SourceType::Official],
      false => vec![SourceType::Official, SourceType::BMCLAPIMirror],
    },
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
      ResourceType::ForgeMavenNew => Ok(Url::parse("https://maven.minecraftforge.net")?),
      ResourceType::ForgeInstall => Ok(Url::parse("https://maven.minecraftforge.net/net/minecraftforge/forge/")?),
      ResourceType::ForgeMeta => Err(ResourceError::NoDownloadApi.into()), // https://github.com/HMCL-dev/HMCL/pull/3259/files
      ResourceType::Liteloader => Ok(Url::parse("https://dl.liteloader.com/versions/versions.json")?),
      ResourceType::Optifine => Err(ResourceError::NoDownloadApi.into()), // 
      ResourceType::AuthlibInjector => Ok(Url::parse("https://authlib-injector.yushi.moe/")?),
      ResourceType::FabricMeta => Ok(Url::parse("https://meta.fabricmc.net/")?),
      ResourceType::FabricMaven => Ok(Url::parse("https://maven.fabricmc.net/")?),
      // https://github.com/HMCL-dev/HMCL/blob/efd088e014bf1c113f7b3fdf73fb983087ae3f5e/HMCLCore/src/main/java/org/jackhuang/hmcl/download/neoforge/NeoForgeOfficialVersionList.java#L28
      ResourceType::NeoforgeMetaForge => Ok(Url::parse("https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/forge/")?),
      ResourceType::NeoforgeMetaNeoforge => Ok(Url::parse("https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge/")?),
      ResourceType::NeoforgeMaven | ResourceType::NeoforgeInstall => Ok(Url::parse("https://maven.neoforged.net/releases/")?),
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
      ResourceType::ForgeMaven | ResourceType::ForgeMavenNew | ResourceType::NeoforgeMaven => Ok(Url::parse("https://bmclapi2.bangbang93.com/maven")?),
      ResourceType::ForgeInstall => Ok(Url::parse("https://bmclapi2.bangbang93.com/forge/download/")?),
      ResourceType::ForgeMeta => Ok(Url::parse("https://bmclapi2.bangbang93.com/forge/")?),
      ResourceType::Liteloader => Ok(Url::parse("https://bmclapi.bangbang93.com/maven/com/mumfrey/liteloader/versions.json")?),
      ResourceType::AuthlibInjector => Ok(Url::parse("https://bmclapi2.bangbang93.com/mirrors/authlib-injector/")?),
      ResourceType::FabricMeta => Ok(Url::parse("https://bmclapi2.bangbang93.com/fabric-meta/")?),
      ResourceType::FabricMaven => Ok(Url::parse("https://bmclapi2.bangbang93.com/maven/")?),
      ResourceType::NeoforgeMetaForge | ResourceType::NeoforgeMetaNeoforge => Ok(Url::parse("https://bmclapi2.bangbang93.com/neoforge/")?),
      ResourceType::NeoforgeInstall => Ok(Url::parse("https://bmclapi2.bangbang93.com/neoforge/version/")?),
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

pub fn convert_url_to_target_source(
  url: &Url,
  resource_types: &[ResourceType],
  dst_type: &SourceType,
) -> SJMCLResult<Url> {
  let url_str = url.as_str();
  let resource_candidates = if resource_types.is_empty() {
    ResourceType::iter().collect::<Vec<_>>()
  } else {
    resource_types.to_vec()
  };

  for resource_type in resource_candidates {
    let dst_api = match get_download_api(*dst_type, resource_type) {
      Ok(api) => api,
      Err(_) => return Ok(url.clone()), // If destination API is not available, return the original URL
    };

    for src_type in SourceType::iter() {
      if &src_type == dst_type {
        continue;
      }

      if let Ok(src_api) = get_download_api(src_type, resource_type) {
        if url_str.starts_with(src_api.as_str()) {
          let new_url_str = url_str.replacen(src_api.as_str(), dst_api.as_str(), 1);
          return Ok(Url::parse(&new_url_str)?);
        }
      }
    }
  }

  // If no replacement occurred, return the original URL
  Ok(url.clone())
}

pub fn version_pack_sort(a: &OtherResourceVersionPack, b: &OtherResourceVersionPack) -> Ordering {
  fn parse_version(version: &str) -> (Vec<u32>, String) {
    let mut version_numbers = Vec::new();
    let mut suffix = String::new();

    for part in version.split('.') {
      if let Some(dash_pos) = part.find('-') {
        let (num_part, suffix_part) = part.split_at(dash_pos);
        if let Ok(num) = num_part.parse::<u32>() {
          version_numbers.push(num);
          suffix = suffix_part.to_string();
        }
        break;
      } else if let Ok(num) = part.parse::<u32>() {
        version_numbers.push(num);
      }
    }

    (version_numbers, suffix)
  }

  fn compare_versions_with_suffix(
    v1: &[u32],
    suffix1: &str,
    v2: &[u32],
    suffix2: &str,
  ) -> Ordering {
    for (a, b) in v1.iter().zip(v2.iter()) {
      match a.cmp(b) {
        Ordering::Equal => continue,
        other => return other,
      }
    }

    match v1.len().cmp(&v2.len()) {
      Ordering::Equal => match (suffix1.is_empty(), suffix2.is_empty()) {
        (true, false) => Ordering::Greater,
        (false, true) => Ordering::Less,
        _ => suffix1.cmp(suffix2),
      },
      other => other,
    }
  }

  let (version_a, suffix_a) = parse_version(&a.name);
  let (version_b, suffix_b) = parse_version(&b.name);

  compare_versions_with_suffix(&version_a, &suffix_a, &version_b, &suffix_b).reverse()
}

pub async fn apply_other_resource_enhancements(
  app: &AppHandle,
  resource_info: &mut OtherResourceInfo,
) -> SJMCLResult<()> {
  // Extract data from cache in a limited scope to avoid holding lock across await
  let (translated_name, mcmod_id) = {
    if let Ok(cache) = app.state::<Mutex<ModDataBase>>().lock() {
      let translated_name = if resource_info._type == "mod" {
        cache.get_translated_name(&resource_info.slug, &resource_info.source)
      } else {
        None
      };
      let mcmod_id = cache.get_mcmod_id(&resource_info.slug, &resource_info.source);
      (translated_name, mcmod_id)
    } else {
      (None, None)
    }
  };

  if let Some(name) = translated_name {
    if name.chars().any(|c| matches!(c, '\u{4e00}'..='\u{9fbb}')) {
      resource_info.translated_name = Some(name);
    }
  }
  if let Some(id) = mcmod_id {
    resource_info.mcmod_id = id;
  }

  // Get translated description
  let translated_desc = match resource_info.source {
    OtherResourceSource::Modrinth => translate_description_modrinth(app, &resource_info.id).await?,
    OtherResourceSource::CurseForge => {
      translate_description_curseforge(app, &resource_info.id).await?
    }
    _ => None,
  };

  if let Some(desc) = translated_desc {
    resource_info.translated_description = Some(desc);
  }

  Ok(())
}
