use base64::{DecodeError, Engine};
use image::codecs::png::PngEncoder;
use image::{ImageBuffer, ImageEncoder, ImageError, ImageReader, Rgba};
use std::io::{Cursor, Read, Seek};
use std::path::Path;
use tokio;
use zip::ZipArchive;

pub fn image_to_base64(image: ImageBuffer<Rgba<u8>, Vec<u8>>) -> Result<String, ImageError> {
  let mut buffer = Cursor::new(Vec::new());
  let encoder = PngEncoder::new(&mut buffer);
  encoder.write_image(
    &image.clone().into_raw(),
    image.width(),
    image.height(),
    image::ColorType::Rgba8.into(),
  )?;

  Ok(base64::engine::general_purpose::STANDARD.encode(buffer.into_inner()))
}

pub fn base64_to_image(
  base64_string: String,
) -> Result<ImageBuffer<Rgba<u8>, Vec<u8>>, DecodeError> {
  let decoded_bytes = base64::engine::general_purpose::STANDARD.decode(base64_string)?;

  let image = image::load_from_memory(&decoded_bytes).unwrap_or_default();

  Ok(image.into_rgba8())
}

pub fn load_image_base64_from_jar<R: Read + Seek>(
  jar: &mut ZipArchive<R>,
  path: &str,
) -> Option<String> {
  let mut file = jar.by_name(path).ok()?;
  let mut buffer = Vec::new();
  file.read_to_end(&mut buffer).ok()?;
  let reader = ImageReader::new(Cursor::new(buffer))
    .with_guessed_format()
    .ok()?;
  let image = reader.decode().ok()?;
  image_to_base64(image.to_rgba8()).ok()
}

pub async fn load_image_base64_from_dir(path: &Path) -> Option<String> {
  let buffer = tokio::fs::read(path).await.ok()?;
  let reader = ImageReader::new(Cursor::new(buffer))
    .with_guessed_format()
    .ok()?;
  let image = reader.decode().ok()?;
  image_to_base64(image.to_rgba8()).ok()
}
