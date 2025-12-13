use lazy_static::lazy_static;
use regex::Regex;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

lazy_static! {
  static ref CRASH_REPORT_REGEX: Regex =
    Regex::new(r"^#@!@# Game crashed! Crash report saved to: #@!@# (.+)$").unwrap();
}

/// Try to parse the crash report path from the game log.
pub fn parse_crash_report_path_from_log<P: AsRef<Path>>(log_path: P) -> Option<PathBuf> {
  let file = File::open(log_path).ok()?;
  let mut reader = BufReader::new(file);

  // Move to the end of the file and only read the last chunk for parsing.
  let file_size = reader.seek(SeekFrom::End(0)).ok()?;
  let read_back_bytes: u64 = 8192; // last ~8KB
  let start_pos = file_size.saturating_sub(read_back_bytes);
  reader.seek(SeekFrom::Start(start_pos)).ok()?;

  let mut content = String::new();
  reader.read_to_string(&mut content).ok()?;

  // Scan backwards so the most recent crash report wins.
  for line in content.lines().rev() {
    if let Some(cap) = CRASH_REPORT_REGEX.captures(line) {
      if let Some(m) = cap.get(1) {
        return Some(PathBuf::from(m.as_str().trim()));
      }
    }
  }

  None
}
