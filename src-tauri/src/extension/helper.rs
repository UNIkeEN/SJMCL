use crate::error::SJMCLResult;
use crate::extension::models::{ExtensionError, ExtensionInfo, ExtensionMetadata};
use crate::utils::image::{load_image_from_dir, ImageWrapper};
use image::imageops::FilterType;
use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use zip::read::ZipArchive;

const EXTENSIONS_DIR_RELATIVE_PATH: &str = "UserContent/Extensions";
const METADATA_FILE_NAME: &str = "sjmcl.ext.json";
const LOGO_FILE_NAME: &str = "icon.png";
const ICON_MAX_SIZE: u32 = 64;

pub fn get_extensions_dir(app: &AppHandle) -> SJMCLResult<PathBuf> {
  Ok(
    app
      .path()
      .resolve::<PathBuf>(EXTENSIONS_DIR_RELATIVE_PATH.into(), BaseDirectory::AppData)?,
  )
}

pub fn read_extension_metadata(extension_dir: &Path) -> SJMCLResult<ExtensionMetadata> {
  let metadata_path = extension_dir.join(METADATA_FILE_NAME);
  if !metadata_path.exists() || !metadata_path.is_file() {
    return Err(ExtensionError::InvalidPackageFormat.into());
  }

  let json_content = fs::read_to_string(metadata_path)?;
  let metadata: ExtensionMetadata = serde_json::from_str(&json_content)
    .map_err(|_| io::Error::other(ExtensionError::InvalidPackageFormat))?;
  metadata.validate()?;
  Ok(metadata)
}

pub fn read_extension_info(extension_dir: &Path) -> SJMCLResult<ExtensionInfo> {
  let metadata = read_extension_metadata(extension_dir)?;
  let icon_src = read_extension_icon(extension_dir);
  Ok(ExtensionInfo::new(metadata, icon_src))
}

pub fn extract_extension_package(package_path: &Path, target_dir: &Path) -> SJMCLResult<()> {
  let package_file = File::open(package_path)?;
  let mut zip = ZipArchive::new(package_file)
    .map_err(|_| io::Error::other(ExtensionError::InvalidPackageFormat))?;

  for i in 0..zip.len() {
    let mut zip_file = zip
      .by_index(i)
      .map_err(|_| io::Error::other(ExtensionError::InvalidPackageFormat))?;
    let relative_path = zip_file.mangled_name();
    let output_path = target_dir.join(relative_path);

    if zip_file.is_dir() {
      fs::create_dir_all(&output_path)?;
      continue;
    }

    if let Some(parent) = output_path.parent() {
      fs::create_dir_all(parent)?;
    }
    let mut output_file = File::create(output_path)?;
    io::copy(&mut zip_file, &mut output_file)?;
  }

  Ok(())
}

fn read_extension_icon(extension_dir: &Path) -> ImageWrapper {
  let logo_path = extension_dir.join(LOGO_FILE_NAME);
  load_image_from_dir(&logo_path)
    .map(ImageWrapper::from)
    .map(compress_icon)
    .unwrap_or_default()
}

fn compress_icon(wrapper: ImageWrapper) -> ImageWrapper {
  let width = wrapper.image.width();
  let height = wrapper.image.height();
  if width == 0 || height == 0 {
    return wrapper;
  }

  let scale = (ICON_MAX_SIZE as f32 / width as f32).min(ICON_MAX_SIZE as f32 / height as f32);
  if scale >= 1.0 {
    return wrapper;
  }

  wrapper.scaled(scale, FilterType::Nearest)
}
