use crate::error::{SJMCLError, SJMCLResult};
use crate::instance::constants::COMPRESSED_ICON_SIZE;
use crate::instance::helpers::mods::{fabric, forge, legacy_forge, liteloader, quilt};
use crate::instance::models::misc::{LocalModInfo, ModLoaderType};
use crate::utils::image::ImageWrapper;
use async_trait::async_trait;
use image::imageops::FilterType;
use std::future::Future;
use std::io::{Cursor, Read, Seek};
use std::path::{Path, PathBuf};
use std::pin::Pin;
use zip::ZipArchive;

pub fn compress_icon(wrapper: ImageWrapper) -> ImageWrapper {
  let resized_image = image::imageops::resize(
    &wrapper.image,
    COMPRESSED_ICON_SIZE.0,
    COMPRESSED_ICON_SIZE.1,
    FilterType::Nearest,
  );
  ImageWrapper {
    image: resized_image,
  }
}

#[async_trait]
pub trait LocalModMetadataParser {
  type Metadata;

  fn get_mod_metadata_from_jar<R: Read + Seek>(
    jar: &mut ZipArchive<R>,
  ) -> SJMCLResult<Self::Metadata>;

  async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<Self::Metadata>;

  fn wrap_icon_from_jar<R: Read + Seek>(
    _meta: &mut Self::Metadata,
    _jar: &mut ZipArchive<R>,
  ) -> ImageWrapper {
    ImageWrapper::default()
  }

  async fn wrap_icon_from_dir(_meta: &mut Self::Metadata, _dir_path: &Path) -> ImageWrapper {
    ImageWrapper::default()
  }
}

struct FallbackManifestModMetadataParser;

fn build_fallback_manifest_local_mod_info<F>(mut get: F) -> LocalModInfo
where
  F: FnMut(&str) -> Option<String>,
{
  let pick = |keys: &[&str], get: &mut F| -> String {
    keys.iter().find_map(|key| get(key)).unwrap_or_default()
  };
  LocalModInfo {
    name: pick(
      &["Implementation-Title", "Specification-Title", "Bundle-Name"],
      &mut get,
    ),
    version: pick(
      &["Implementation-Version", "Specification-Version"],
      &mut get,
    ),
    description: pick(&["Implementation-Vendor", "Specification-Vendor"], &mut get),
    loader_type: ModLoaderType::Unknown,
    ..Default::default()
  }
}

#[async_trait]
impl LocalModMetadataParser for FallbackManifestModMetadataParser {
  type Metadata = LocalModInfo;

  fn get_mod_metadata_from_jar<R: Read + Seek>(
    jar: &mut ZipArchive<R>,
  ) -> SJMCLResult<Self::Metadata> {
    let manifest_file = jar.by_name("META-INF/MANIFEST.MF")?;
    let manifest = java_properties::read(manifest_file)?;
    Ok(build_fallback_manifest_local_mod_info(|key| {
      manifest.get(key).cloned()
    }))
  }

  async fn get_mod_metadata_from_dir(dir_path: &Path) -> SJMCLResult<Self::Metadata> {
    let manifest_string = tokio::fs::read_to_string(dir_path.join("META-INF/MANIFEST.MF")).await?;
    let manifest = java_properties::read(Cursor::new(manifest_string))?;
    Ok(build_fallback_manifest_local_mod_info(|key| {
      manifest.get(key).cloned()
    }))
  }
}

type ParserFuncTuple = (
  fn(&mut ZipArchive<Cursor<Vec<u8>>>) -> Option<LocalModInfo>,
  for<'a> fn(&'a Path) -> Pin<Box<dyn Future<Output = Option<LocalModInfo>> + Send + 'a>>,
);

fn parse_mod_info_from_jar<P>(jar: &mut ZipArchive<Cursor<Vec<u8>>>) -> Option<LocalModInfo>
where
  P: LocalModMetadataParser,
  LocalModInfo: From<P::Metadata>,
{
  let mut meta = P::get_mod_metadata_from_jar(jar).ok()?;
  let icon_src = P::wrap_icon_from_jar(&mut meta, jar);
  let mut local_mod_info = LocalModInfo::from(meta);
  local_mod_info.icon_src = icon_src;
  Some(local_mod_info)
}

fn parse_mod_info_from_dir<P>(
  dir_path: &Path,
) -> Pin<Box<dyn Future<Output = Option<LocalModInfo>> + Send + '_>>
where
  P: LocalModMetadataParser + Send,
  P::Metadata: Send,
  LocalModInfo: From<P::Metadata>,
{
  Box::pin(async move {
    let mut meta = P::get_mod_metadata_from_dir(dir_path).await.ok()?;
    let icon_src = P::wrap_icon_from_dir(&mut meta, dir_path).await;
    let mut local_mod_info = LocalModInfo::from(meta);
    local_mod_info.icon_src = icon_src;
    Some(local_mod_info)
  })
}

const DEFAULT_MOD_LOADER_PRIORITY_LIST: [(ModLoaderType, ParserFuncTuple); 6] = [
  (
    ModLoaderType::Fabric,
    (
      parse_mod_info_from_jar::<fabric::FabricModMetadataParser>,
      parse_mod_info_from_dir::<fabric::FabricModMetadataParser>,
    ),
  ),
  (
    ModLoaderType::Forge,
    (
      parse_mod_info_from_jar::<forge::ForgeModMetadataParser>,
      parse_mod_info_from_dir::<forge::ForgeModMetadataParser>,
    ),
  ),
  (
    ModLoaderType::LegacyForge,
    (
      parse_mod_info_from_jar::<legacy_forge::LegacyForgeModMetadataParser>,
      parse_mod_info_from_dir::<legacy_forge::LegacyForgeModMetadataParser>,
    ),
  ),
  (
    ModLoaderType::LiteLoader,
    (
      parse_mod_info_from_jar::<liteloader::LiteLoaderModMetadataParser>,
      parse_mod_info_from_dir::<liteloader::LiteLoaderModMetadataParser>,
    ),
  ),
  (
    ModLoaderType::Quilt,
    (
      parse_mod_info_from_jar::<quilt::QuiltModMetadataParser>,
      parse_mod_info_from_dir::<quilt::QuiltModMetadataParser>,
    ),
  ),
  (
    ModLoaderType::Unknown,
    (
      parse_mod_info_from_jar::<FallbackManifestModMetadataParser>,
      parse_mod_info_from_dir::<FallbackManifestModMetadataParser>,
    ),
  ),
];

// first try to get metadata from target mod loader.
fn build_priority_parser_list(loader_type: Option<ModLoaderType>) -> Vec<ParserFuncTuple> {
  let preferred_loader = match loader_type {
    Some(ModLoaderType::NeoForge) => Some(ModLoaderType::Forge),
    Some(ModLoaderType::Unknown) | None => None,
    other => other,
  };
  let mut priority_list = DEFAULT_MOD_LOADER_PRIORITY_LIST
    .iter()
    .map(|(loader_type, parser)| (loader_type.clone(), *parser))
    .collect::<Vec<_>>();
  if let Some(loader) = preferred_loader {
    let mut target = Vec::with_capacity(1);
    priority_list.retain(|(loader_type, parser)| {
      if *loader_type == loader {
        target.push(*parser);
        false
      } else {
        true
      }
    });
    target.extend(priority_list.into_iter().map(|(_, parser)| parser));
    return target;
  }
  priority_list
    .into_iter()
    .map(|(_, parser)| parser)
    .collect()
}

pub async fn get_mod_info_from_jar(
  path: &PathBuf,
  prior_loader_type: Option<ModLoaderType>,
) -> SJMCLResult<LocalModInfo> {
  let file = Cursor::new(tokio::fs::read(path).await?);
  let file_name = path
    .file_name()
    .map(|name| name.to_string_lossy().to_string())
    .ok_or_else(|| SJMCLError(format!("invalid mod file path: {}", path.display())))?;
  let normalized_file_name = file_name.strip_suffix(".disabled").unwrap_or(&file_name);
  let file_stem = Path::new(normalized_file_name)
    .file_stem()
    .map(|stem| stem.to_string_lossy().to_string())
    .unwrap_or_else(|| normalized_file_name.to_string());
  let file_path = path.clone();
  let enabled = !file_name.ends_with(".disabled");
  let mut jar = ZipArchive::new(file)?;

  for parser in build_priority_parser_list(prior_loader_type) {
    if let Some(mut local_mod_info) = (parser.0)(&mut jar) {
      local_mod_info.enabled = enabled;
      local_mod_info.file_name = file_stem.clone();
      local_mod_info.file_path = file_path.clone();
      return Ok(local_mod_info);
    }
  }

  Err(SJMCLError(format!(
    "{} cannot be recognized as known",
    file_name
  )))
}

pub async fn get_mod_info_from_dir(
  path: &Path,
  prior_loader_type: Option<ModLoaderType>,
) -> SJMCLResult<LocalModInfo> {
  let dir_name = path
    .file_name()
    .map(|name| name.to_string_lossy().to_string())
    .unwrap_or_else(|| path.to_string_lossy().to_string());
  // only remove .disabled suffix if exists, not consider other extension-like suffix in dir name.
  let dir_stem = dir_name
    .strip_suffix(".disabled")
    .unwrap_or(&dir_name)
    .to_string();
  let enabled = !dir_name.ends_with(".disabled");

  for parser in build_priority_parser_list(prior_loader_type) {
    if let Some(mut local_mod_info) = (parser.1)(path).await {
      local_mod_info.enabled = enabled;
      local_mod_info.file_name = dir_stem.clone();
      local_mod_info.file_path = path.to_path_buf();
      return Ok(local_mod_info);
    }
  }

  Err(SJMCLError(format!(
    "{} cannot be recognized as known",
    dir_name
  )))
}
