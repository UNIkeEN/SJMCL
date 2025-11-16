use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

/// Try to parse the crash report path from the game log.
pub fn parse_crash_report_path_from_log<P: AsRef<Path>>(log_path: P) -> Option<PathBuf> {
  let file = File::open(log_path).ok()?;
  let mut reader = BufReader::new(file);

  // Move to the end of the file and only read the last chunk for parsing.
  let file_size = reader.seek(SeekFrom::End(0)).ok()?;
  let read_back_bytes: u64 = 8192; // last ~8KB
  let start_pos = if file_size > read_back_bytes {
    file_size - read_back_bytes
  } else {
    0
  };
  reader.seek(SeekFrom::Start(start_pos)).ok()?;

  let mut content = String::new();
  reader.read_to_string(&mut content).ok()?;

  // Scan backwards so the most recent crash report wins.
  for line in content.lines().rev() {
    let lower = line.to_ascii_lowercase();
    if !lower.contains("crash report saved to:") {
      continue;
    }

    if let Some(idx) = lower.find("crash report saved to:") {
      let path_part = line[idx + "crash report saved to:".len()..].trim_start();
      let cleaned_path = path_part
        .trim_start_matches(|c: char| matches!(c, '#' | '@' | '!' | '?'))
        .trim_start();

      if cleaned_path.is_empty() {
        continue;
      }

      let path = PathBuf::from(cleaned_path);
      if path.exists() {
        return Some(path);
      }
    }
  }

  None
}
