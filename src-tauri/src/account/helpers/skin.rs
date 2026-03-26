use crate::utils::image::ImageWrapper;
use image::RgbaImage;

pub fn draw_avatar(size: u32, img: &RgbaImage) -> Vec<ImageWrapper> {
  let (skin_width, _) = img.dimensions();

  let scale = skin_width as f32 / 64.0;
  let face_offset = ((size as f32 / 18.0).round()) as u32;

  let mut avatar = vec![RgbaImage::new(size, size), RgbaImage::new(size, size)];

  // Draw face
  draw_image_section(
    img,
    &[8.0 * scale, 8.0 * scale, 8.0 * scale, 8.0 * scale],
    &[
      face_offset,
      face_offset,
      size - 2 * face_offset,
      size - 2 * face_offset,
    ],
    &mut avatar[0],
  );

  // Draw hat
  draw_image_section(
    img,
    &[40.0 * scale, 8.0 * scale, 8.0 * scale, 8.0 * scale],
    &[0, 0, size, size],
    &mut avatar[1],
  );

  avatar.into_iter().map(ImageWrapper::from).collect()
}

fn draw_image_section(
  img: &RgbaImage,
  src_rect: &[f32; 4],
  dest_rect: &[u32; 4],
  avatar_img: &mut RgbaImage,
) {
  let x_scale = src_rect[2] / dest_rect[2] as f32;
  let y_scale = src_rect[3] / dest_rect[3] as f32;
  for x_offset in 0..dest_rect[2] {
    for y_offset in 0..dest_rect[3] {
      let pixel = img.get_pixel(
        (src_rect[0] + x_offset as f32 * x_scale) as u32,
        (src_rect[1] + y_offset as f32 * y_scale) as u32,
      );
      if pixel.0[3] == 0 {
        continue;
      }
      avatar_img.put_pixel(dest_rect[0] + x_offset, dest_rect[1] + y_offset, *pixel);
    }
  }
}
