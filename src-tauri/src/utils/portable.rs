use std::fs::File;
use std::io;
use std::io::{Read, Seek, SeekFrom};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use zip::read::ZipArchive;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PortableInfo {
  pub zip_offset: u64,
  pub zip_size: usize,
}

/// Helper function to check and read trailer data at a specific file offset.
///
/// Trailer format:
/// `[PORT (4 bytes)] + [zip_offset (4 bytes LE u32)] + [zip_size (4 bytes LE u32)]`
fn try_read_trailer<R: Read + Seek>(
  reader: &mut R,
  trailer_start: u64,
  file_len: u64,
) -> Result<Option<PortableInfo>, io::Error> {
  if trailer_start
    .checked_add(12)
    .map_or(true, |end| end > file_len)
  {
    return Ok(None);
  }

  reader.seek(SeekFrom::Start(trailer_start))?;
  let mut buf = [0u8; 12];
  reader.read_exact(&mut buf)?;

  if &buf[0..4] != b"PORT" {
    return Ok(None);
  }

  let offset = u32::from_le_bytes([buf[4], buf[5], buf[6], buf[7]]) as u64;
  let zip_size = u32::from_le_bytes([buf[8], buf[9], buf[10], buf[11]]) as u64;

  if offset == 0 || zip_size == 0 {
    return Ok(None);
  }

  let calculated_trailer_start = match offset.checked_add(zip_size) {
    Some(val) => val,
    None => return Ok(None),
  };

  // The zip archive must end exactly where the trailer begins
  if calculated_trailer_start != trailer_start {
    return Ok(None);
  }

  Ok(Some(PortableInfo {
    zip_offset: offset,
    zip_size: zip_size as usize,
  }))
}

/// Parses the PE Security Directory (Attribute Certificate Table entry) from the Optional Header.
/// Returns `Ok(Some((virtual_address, size)))` where `virtual_address` is the file offset of the certificate table.
#[cfg(any(windows, test))]
fn parse_pe_security_directory<R: Read + Seek>(
  reader: &mut R,
  file_len: u64,
) -> Result<Option<(u32, u32)>, io::Error> {
  // DOS Header is 64 (0x40) bytes
  if file_len < 0x40 {
    return Ok(None);
  }

  reader.seek(SeekFrom::Start(0))?;
  let mut dos_header = [0u8; 0x40];
  reader.read_exact(&mut dos_header)?;

  if dos_header[0] != b'M' || dos_header[1] != b'Z' {
    return Ok(None);
  }

  let pe_offset = u32::from_le_bytes([
    dos_header[0x3C],
    dos_header[0x3D],
    dos_header[0x3E],
    dos_header[0x3F],
  ]) as u64;

  // PE Signature (4 bytes) + COFF File Header (20 bytes) = 24 bytes
  if pe_offset.checked_add(24).map_or(true, |end| end > file_len) {
    return Ok(None);
  }

  reader.seek(SeekFrom::Start(pe_offset))?;
  let mut pe_signature = [0u8; 4];
  reader.read_exact(&mut pe_signature)?;
  if &pe_signature != b"PE\0\0" {
    return Ok(None);
  }

  let mut coff_header = [0u8; 20];
  reader.read_exact(&mut coff_header)?;
  let size_of_optional_header = u16::from_le_bytes([coff_header[16], coff_header[17]]) as u64;
  if size_of_optional_header == 0 {
    return Ok(None);
  }

  let opt_header_start = pe_offset + 24;
  if opt_header_start
    .checked_add(size_of_optional_header)
    .map_or(true, |end| end > file_len)
  {
    return Ok(None);
  }

  reader.seek(SeekFrom::Start(opt_header_start))?;
  let mut magic_buf = [0u8; 2];
  reader.read_exact(&mut magic_buf)?;
  let magic = u16::from_le_bytes(magic_buf);

  // Security Directory is the 5th entry (index 4) in the Data Directory array:
  // PE32 (0x10B): Data Directory begins at offset 96. Index 4 offset = 96 + 4 * 8 = 128.
  // PE32+ (0x20B): Data Directory begins at offset 112. Index 4 offset = 112 + 4 * 8 = 144.
  let sec_dir_rel_offset = match magic {
    0x010B => 96 + 4 * 8,
    0x020B => 112 + 4 * 8,
    _ => return Ok(None),
  };

  if (sec_dir_rel_offset + 8) as u64 > size_of_optional_header {
    return Ok(None);
  }

  reader.seek(SeekFrom::Start(
    opt_header_start + sec_dir_rel_offset as u64,
  ))?;
  let mut sec_entry = [0u8; 8];
  reader.read_exact(&mut sec_entry)?;

  let virtual_address =
    u32::from_le_bytes([sec_entry[0], sec_entry[1], sec_entry[2], sec_entry[3]]);
  let size = u32::from_le_bytes([sec_entry[4], sec_entry[5], sec_entry[6], sec_entry[7]]);

  Ok(Some((virtual_address, size)))
}

#[cfg(any(windows, test))]
fn locate_portable_info_windows<R: Read + Seek>(
  reader: &mut R,
  file_len: u64,
) -> Result<Option<PortableInfo>, io::Error> {
  if file_len < 12 {
    return Ok(None);
  }

  // 1. Try resolving PE Security Directory to check if this binary is signed
  if let Ok(Some((virtual_address, size))) = parse_pe_security_directory(reader, file_len) {
    let cert_offset = virtual_address as u64;
    let cert_size = size as u64;

    if cert_offset > 0
      && cert_size > 0
      && cert_offset
        .checked_add(cert_size)
        .map_or(false, |end| end <= file_len)
    {
      // Signed PE: Authenticode Certificate Table is appended to the end of the file.
      // Because the Certificate Table is 8-byte aligned, there may be 0..=7 bytes of padding
      // between the end of our overlay trailer and the start of the Certificate Table.
      for padding in 0..=7 {
        if cert_offset < 12 + padding {
          break;
        }
        let trailer_start = cert_offset - 12 - padding;
        if let Some(info) = try_read_trailer(reader, trailer_start, file_len)? {
          return Ok(Some(info));
        }
      }

      // If signed, the overlay must precede the Certificate Table.
      return Ok(None);
    }
  }

  // 2. Unsigned PE or fallback: locate trailer from EOF
  try_read_trailer(reader, file_len - 12, file_len)
}

#[cfg(all(not(windows), not(test)))]
fn locate_portable_info_non_windows<R: Read + Seek>(
  reader: &mut R,
  file_len: u64,
) -> Result<Option<PortableInfo>, io::Error> {
  if file_len < 12 {
    return Ok(None);
  }
  try_read_trailer(reader, file_len - 12, file_len)
}

pub fn locate_portable_info<R: Read + Seek>(
  reader: &mut R,
) -> Result<Option<PortableInfo>, io::Error> {
  let file_len = reader.seek(SeekFrom::End(0))?;

  #[cfg(windows)]
  {
    locate_portable_info_windows(reader, file_len)
  }

  #[cfg(all(not(windows), not(test)))]
  {
    locate_portable_info_non_windows(reader, file_len)
  }

  #[cfg(all(not(windows), test))]
  {
    locate_portable_info_windows(reader, file_len)
  }
}

pub fn is_portable() -> Result<bool, io::Error> {
  let exe_path = std::env::current_exe()?;
  let mut file = File::open(&exe_path)?;
  Ok(locate_portable_info(&mut file)?.is_some())
}

pub fn extract_assets(app: &AppHandle) -> Result<(), io::Error> {
  let exe_path = std::env::current_exe()?;
  let mut file = File::open(&exe_path)?;
  let info = locate_portable_info(&mut file)?
    .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Portable footer not found"))?;

  file.seek(SeekFrom::Start(info.zip_offset))?;
  let mut zip_data = vec![0u8; info.zip_size];
  file.read_exact(&mut zip_data)?;

  let cursor = std::io::Cursor::new(zip_data);
  let mut zip = ZipArchive::new(cursor)?;
  for i in 0..zip.len() {
    let mut file_in_zip = zip.by_index(i)?;
    let out_path = app
      .path()
      .resolve(file_in_zip.mangled_name()?, BaseDirectory::AppData)
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

#[cfg(test)]
mod tests {
  use super::*;
  use std::io::Cursor;

  fn build_minimal_pe(is_pe32_plus: bool, cert_table: Option<(u32, u32)>) -> Vec<u8> {
    let mut pe = vec![0u8; 512];
    // DOS header
    pe[0] = b'M';
    pe[1] = b'Z';
    // e_lfanew = 0x80
    let pe_offset = 0x80u32;
    pe[0x3C..0x40].copy_from_slice(&pe_offset.to_le_bytes());

    let pe_off = pe_offset as usize;
    // PE\0\0
    pe[pe_off..pe_off + 4].copy_from_slice(b"PE\0\0");

    // COFF Header (20 bytes)
    // SizeOfOptionalHeader at offset 16
    let opt_size = if is_pe32_plus { 240u16 } else { 224u16 };
    pe[pe_off + 20..pe_off + 22].copy_from_slice(&opt_size.to_le_bytes());

    let opt_start = pe_off + 24;
    // Magic: 0x20B (PE32+) or 0x10B (PE32)
    let magic = if is_pe32_plus { 0x020Bu16 } else { 0x010Bu16 };
    pe[opt_start..opt_start + 2].copy_from_slice(&magic.to_le_bytes());

    if let Some((v_addr, size)) = cert_table {
      let sec_dir_rel = if is_pe32_plus {
        112 + 4 * 8
      } else {
        96 + 4 * 8
      };
      let entry_start = opt_start + sec_dir_rel;
      pe[entry_start..entry_start + 4].copy_from_slice(&v_addr.to_le_bytes());
      pe[entry_start + 4..entry_start + 8].copy_from_slice(&size.to_le_bytes());
    }

    pe
  }

  #[test]
  fn test_empty_and_short_files() {
    let mut cursor = Cursor::new(vec![]);
    assert_eq!(locate_portable_info(&mut cursor).unwrap(), None);

    let mut cursor = Cursor::new(vec![0u8; 11]);
    assert_eq!(locate_portable_info(&mut cursor).unwrap(), None);
  }

  #[test]
  fn test_unsigned_regular_pe() {
    let pe = build_minimal_pe(true, None);
    let mut cursor = Cursor::new(pe);
    assert_eq!(locate_portable_info(&mut cursor).unwrap(), None);
  }

  #[test]
  fn test_unsigned_portable_pe() {
    let mut data = build_minimal_pe(true, None);
    let zip_offset = data.len() as u64;
    let dummy_zip = b"PK\x03\x04fake_zip_content";
    data.extend_from_slice(dummy_zip);
    let zip_size = dummy_zip.len() as u64;

    // Append trailer: PORT + offset + size
    data.extend_from_slice(b"PORT");
    data.extend_from_slice(&(zip_offset as u32).to_le_bytes());
    data.extend_from_slice(&(zip_size as u32).to_le_bytes());

    let mut cursor = Cursor::new(data);
    let info = locate_portable_info(&mut cursor).unwrap();
    assert_eq!(
      info,
      Some(PortableInfo {
        zip_offset,
        zip_size: zip_size as usize,
      })
    );
  }

  #[test]
  fn test_signed_portable_pe32_plus_with_various_paddings() {
    for padding in 0..=7 {
      let mut data = build_minimal_pe(true, None);
      let zip_offset = data.len() as u64;
      let dummy_zip = b"PK\x03\x04sample_zip_data";
      data.extend_from_slice(dummy_zip);
      let zip_size = dummy_zip.len() as u64;

      // Trailer
      data.extend_from_slice(b"PORT");
      data.extend_from_slice(&(zip_offset as u32).to_le_bytes());
      data.extend_from_slice(&(zip_size as u32).to_le_bytes());

      // Padding before Certificate Table (8-byte alignment)
      data.extend_from_slice(&vec![0u8; padding]);

      let cert_offset = data.len() as u32;
      let cert_size = 128u32;
      // Dummy Certificate Table
      data.extend_from_slice(&vec![0xAA; cert_size as usize]);

      // Update Security Directory in PE Header
      let sec_dir_rel = 112 + 4 * 8;
      let entry_start = 0x80 + 24 + sec_dir_rel;
      data[entry_start..entry_start + 4].copy_from_slice(&cert_offset.to_le_bytes());
      data[entry_start + 4..entry_start + 8].copy_from_slice(&cert_size.to_le_bytes());

      let mut cursor = Cursor::new(data);
      let info = locate_portable_info(&mut cursor).unwrap();
      assert_eq!(
        info,
        Some(PortableInfo {
          zip_offset,
          zip_size: zip_size as usize,
        }),
        "Failed with padding {}",
        padding
      );
    }
  }

  #[test]
  fn test_signed_portable_pe32() {
    let mut data = build_minimal_pe(false, None);
    let zip_offset = data.len() as u64;
    let dummy_zip = b"PK\x03\x0432bit_zip";
    data.extend_from_slice(dummy_zip);
    let zip_size = dummy_zip.len() as u64;

    data.extend_from_slice(b"PORT");
    data.extend_from_slice(&(zip_offset as u32).to_le_bytes());
    data.extend_from_slice(&(zip_size as u32).to_le_bytes());

    let cert_offset = data.len() as u32;
    let cert_size = 64u32;
    data.extend_from_slice(&vec![0xBB; cert_size as usize]);

    // Update Security Directory in PE32
    let sec_dir_rel = 96 + 4 * 8;
    let entry_start = 0x80 + 24 + sec_dir_rel;
    data[entry_start..entry_start + 4].copy_from_slice(&cert_offset.to_le_bytes());
    data[entry_start + 4..entry_start + 8].copy_from_slice(&cert_size.to_le_bytes());

    let mut cursor = Cursor::new(data);
    let info = locate_portable_info(&mut cursor).unwrap();
    assert_eq!(
      info,
      Some(PortableInfo {
        zip_offset,
        zip_size: zip_size as usize,
      })
    );
  }

  #[test]
  fn test_corrupt_trailer_offset_mismatch() {
    let mut data = build_minimal_pe(true, None);
    let zip_offset = data.len() as u64;
    let dummy_zip = b"PK\x03\x04sample_zip_data";
    data.extend_from_slice(dummy_zip);

    data.extend_from_slice(b"PORT");
    // Incorrect offset
    data.extend_from_slice(&((zip_offset - 10) as u32).to_le_bytes());
    data.extend_from_slice(&(dummy_zip.len() as u32).to_le_bytes());

    let mut cursor = Cursor::new(data);
    assert_eq!(locate_portable_info(&mut cursor).unwrap(), None);
  }
}
