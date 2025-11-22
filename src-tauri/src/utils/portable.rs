use std::fs::File;
use std::io;
use std::io::{Read, Seek, SeekFrom};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use zip::read::ZipArchive;

pub fn is_portable() -> Result<bool, io::Error> {
  let exe_path = std::env::current_exe()?;
  let mut file = File::open(&exe_path)?;
  file.seek(SeekFrom::End(-12))?;
  let mut footer = [0u8; 4];
  file.read_exact(&mut footer)?;
  if &footer == b"PORT" {
    Ok(true)
  } else {
    Ok(false)
  }
}

pub fn extract_assets(app: &AppHandle) -> Result<(), io::Error> {
  let exe_path = std::env::current_exe()?;
  let mut file = File::open(&exe_path)?;
  file.seek(SeekFrom::End(-8))?;
  let mut footer = [0u8; 8];
  file.read_exact(&mut footer)?;

  let offset = u32::from_le_bytes([footer[0], footer[1], footer[2], footer[3]]) as u64;
  let zip_size = u32::from_le_bytes([footer[4], footer[5], footer[6], footer[7]]) as usize;

  file.seek(SeekFrom::Start(offset))?;
  let mut zip_data = vec![0u8; zip_size];
  file.read_exact(&mut zip_data)?;

  let cursor = std::io::Cursor::new(zip_data);
  let mut zip = ZipArchive::new(cursor)?;
  for i in 0..zip.len() {
    let mut file_in_zip = zip.by_index(i)?;
    let out_path = app
      .path()
      .resolve(file_in_zip.mangled_name(), BaseDirectory::AppData)
      .map_err(io::Error::other)?;

    if file_in_zip.is_dir() {
      std::fs::create_dir_all(&out_path)?;
    } else {
      if let Some(parent) = out_path.parent() {
        std::fs::create_dir_all(parent)?;
      }
      let mut outfile = File::create(&out_path)?;
      std::io::copy(&mut file_in_zip, &mut outfile)?;
    }
  }
  Ok(())
}
