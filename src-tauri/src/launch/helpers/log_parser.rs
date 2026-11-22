use lazy_static::lazy_static;
use regex::Regex;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

lazy_static! {
  static ref CRASH_REPORT_REGEX: Regex =
    Regex::new(r"^#@!@# Game crashed! Crash report saved to: #@!@# (.+)$").unwrap();
  static ref ACCESS_TOKEN_REGEX: Regex = Regex::new(r"(--accessToken(?:\s+|=))\S+").unwrap();
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

  let mut buf = Vec::new();
  reader.read_to_end(&mut buf).ok()?;
  Some(String::from_utf8_lossy(&buf).into_owned())
}

/// Parse the crash report and JVM `hs_err` report paths from the game log.
pub fn parse_crash_paths_from_log<P: AsRef<Path>>(
  log_path: P,
) -> (Option<PathBuf>, Option<PathBuf>) {
  let Some(content) = read_log_tail(log_path) else {
    return (None, None);
  };

  let lines: Vec<&str> = content.lines().collect();

  // Scan backwards so the most recent crash report wins.
  let crash_report_path = lines.iter().rev().find_map(|line| {
    CRASH_REPORT_REGEX
      .captures(line)
      .and_then(|cap| cap.get(1))
      .map(|m| PathBuf::from(m.as_str().trim()))
  });

  // JVM prints:
  // # An error report file with more information is saved as:
  // # /path/to/hs_err_pid1234.log
  let hs_err_path = lines.windows(2).rev().find_map(|pair| {
    if pair[0].trim() == "# An error report file with more information is saved as:"
      && let Some(path_str) = pair[1].strip_prefix('#')
    {
      let trimmed = path_str.trim();
      if !trimmed.is_empty() {
        return Some(PathBuf::from(trimmed));
      }
    }
    None
  });

  (crash_report_path, hs_err_path)
}

/// Redact `--accessToken` values from exported text such as `hs_err` logs.
pub fn redact_access_token(content: &str) -> String {
  ACCESS_TOKEN_REGEX.replace_all(content, "${1}***").into_owned()
}
