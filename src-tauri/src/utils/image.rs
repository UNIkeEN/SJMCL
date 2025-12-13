use base64::Engine;
use image::codecs::png::PngEncoder;
use image::imageops::{resize, FilterType};
use image::{ImageEncoder, ImageError, ImageReader, RgbaImage};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fs;
use std::io::{Cursor, Read, Seek};
use std::path::Path;
use tokio;
use zip::ZipArchive;

pub fn decode_image(buffer: Vec<u8>) -> Result<RgbaImage, ImageError> {
  let reader = ImageReader::new(Cursor::new(buffer)).with_guessed_format()?;
  let image = reader.decode()?;
  Ok(image.to_rgba8())
}

pub fn load_image_from_jar<R: Read + Seek>(
  jar: &mut ZipArchive<R>,
  path: &str,
) -> Option<RgbaImage> {
  let mut file = jar.by_name(path).ok()?;

  let mut buffer = Vec::new();
  file.read_to_end(&mut buffer).ok()?;
  decode_image(buffer).ok()
}

pub async fn load_image_from_dir_async(path: &Path) -> Option<RgbaImage> {
  let buffer = tokio::fs::read(path).await.ok()?;
  decode_image(buffer).ok()
}

pub fn load_image_from_dir(path: &Path) -> Option<RgbaImage> {
  let buffer = fs::read(path).ok()?;
  decode_image(buffer).ok()
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ImageWrapper {
  pub image: RgbaImage,
}

impl From<RgbaImage> for ImageWrapper {
  fn from(image: RgbaImage) -> Self {
    ImageWrapper { image }
  }
}

impl From<ImageWrapper> for RgbaImage {
  fn from(val: ImageWrapper) -> Self {
    val.image
  }
}

impl Serialize for ImageWrapper {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: Serializer,
  {
    if self.image.width() == 0 || self.image.height() == 0 {
      return serializer.serialize_str("");
    }
    let mut buffer = Cursor::new(Vec::new());
    let encoder = PngEncoder::new(&mut buffer);
    encoder
      .write_image(
        self.image.as_raw(),
        self.image.width(),
        self.image.height(),
        image::ColorType::Rgba8.into(),
      )
      .map_err(serde::ser::Error::custom)?;

    let base64_str = base64::engine::general_purpose::STANDARD.encode(buffer.into_inner());
    serializer.serialize_str(&base64_str)
  }
}

impl<'de> Deserialize<'de> for ImageWrapper {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: Deserializer<'de>,
  {
    let base64_str = String::deserialize(deserializer)?;
    let decoded_bytes = base64::engine::general_purpose::STANDARD
      .decode(&base64_str)
      .map_err(serde::de::Error::custom)?;

    let image = image::load_from_memory(&decoded_bytes).map_err(serde::de::Error::custom)?;

    Ok(image.into_rgba8().into())
  }
}

impl ImageWrapper {
  /// Return a new ImageWrapper resized to the given dimensions using the specified filter.
  ///
  /// # Examples
  ///
  /// ```rust
  /// let resized_img = img_wrapper.resized(100, 100, FilterType::Nearest);
  /// ```
  pub fn resized(&self, new_width: u32, new_height: u32, filter: FilterType) -> ImageWrapper {
    if self.image.width() == 0 || self.image.height() == 0 {
      return self.clone();
    }
    let w = new_width.max(1);
    let h = new_height.max(1);
    let img = resize(&self.image, w, h, filter);
    ImageWrapper::from(img)
  }

  /// Return a new ImageWrapper scaled by `scale` while preserving aspect ratio.
  ///
  /// # Examples
  ///
  /// ```rust
  /// let scaled_img = img_wrapper.scaled(0.5, FilterType::Nearest);
  /// ```
  pub fn scaled(&self, scale: f32, filter: FilterType) -> ImageWrapper {
    if self.image.width() == 0 || self.image.height() == 0 || scale <= 0.0 {
      return self.clone();
    }
    let w = ((self.image.width() as f32) * scale).max(1.0) as u32;
    let h = ((self.image.height() as f32) * scale).max(1.0) as u32;
    self.resized(w, h, filter)
  }
}
