use lazy_static::lazy_static;
use regex::Regex;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

lazy_static! {
  static ref CRASH_REPORT_REGEX: Regex =
    Regex::new(r"^#@!@# Game crashed! Crash report saved to: #@!@# (.+)$").unwrap();
}

/// Read the trailing chunk of a log file (last ~8KB) for crash/error path parsing.
fn read_log_tail<P: AsRef<Path>>(log_path: P) -> Option<String> {
  let file = File::open(log_path).ok()?;
  let mut reader = BufReader::new(file);

  // Move to the end of the file and only read the last chunk for parsing.
  let file_size = reader.seek(SeekFrom::End(0)).ok()?;
  let read_back_bytes: u64 = 8192; // last ~8KB
  let start_pos = file_size.saturating_sub(read_back_bytes);
  reader.seek(SeekFrom::Start(start_pos)).ok()?;

  let mut content = String::new();
  reader.read_to_string(&mut content).ok()?;
  Some(content)
}

/// Try to parse the crash report path from the game log.
pub fn parse_crash_report_path_from_log<P: AsRef<Path>>(log_path: P) -> Option<PathBuf> {
  let content = read_log_tail(log_path)?;

  // Scan backwards so the most recent crash report wins.
  for line in content.lines().rev() {
    if let Some(cap) = CRASH_REPORT_REGEX.captures(line)
      && let Some(m) = cap.get(1)
    {
      return Some(PathBuf::from(m.as_str().trim()));
    }
  }

  None
}

/// Try to parse the JVM `hs_err` report path from the game log.
pub fn parse_hs_err_path_from_log<P: AsRef<Path>>(log_path: P) -> Option<PathBuf> {
  let content = read_log_tail(log_path)?;
  let lines: Vec<&str> = content.lines().collect();

  // JVM prints:
  // # An error report file with more information is saved as:
  // # /path/to/hs_err_pid1234.log
  for pair in lines.windows(2).rev() {
    if pair[0].trim() == "# An error report file with more information is saved as:"
      && let Some(path_str) = pair[1].strip_prefix('#')
    {
      let trimmed = path_str.trim();
      if !trimmed.is_empty() {
        return Some(PathBuf::from(trimmed));
      }
    }
  }

  None
}
