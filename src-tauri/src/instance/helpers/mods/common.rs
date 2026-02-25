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

pub type LocalModParser = (
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

pub const DEFAULT_MOD_LOADER_PRIORITY_LIST: [(ModLoaderType, LocalModParser); 5] = [
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
];

// first try to get metadata from target mod loader.
pub fn build_priority_parser_list(loader_type: Option<ModLoaderType>) -> Vec<LocalModParser> {
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
  let file_name = path.file_name().unwrap().to_string_lossy().to_string();
  let file_stem = PathBuf::from(file_name.strip_suffix(".disabled").unwrap_or(&file_name))
    .file_stem()
    .unwrap()
    .to_string_lossy()
    .to_string();
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
  let dir_name = path.file_name().unwrap().to_string_lossy().to_string();
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
