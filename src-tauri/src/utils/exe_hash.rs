use lazy_static::lazy_static;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::path::PathBuf;
use std::sync::Mutex;

lazy_static! {
  static ref EXECUTABLE_HASH_CACHE: Mutex<Option<String>> = Mutex::new(None);
}

/// Calculates the SHA256 hash of the current executable.
///
/// This function caches the hash after the first calculation, as the executable
/// is assumed not to change during runtime.
///
/// # Returns
/// Returns the SHA256 hash as a hex string, or an empty string if calculation fails.
///
/// # Examples
/// ```rust
/// let hash = get_executable_sha256();
/// println!("Executable SHA256: {}", hash);
/// ```
pub fn get_executable_sha256() -> String {
  // Check if hash is already cached
  {
    let cache = EXECUTABLE_HASH_CACHE.lock().unwrap();
    if let Some(cached_hash) = cache.as_ref() {
      return cached_hash.clone();
    }
  }

  // Calculate hash if not cached
  let hash = calculate_executable_hash();

  // Store in cache
  {
    let mut cache = EXECUTABLE_HASH_CACHE.lock().unwrap();
    *cache = Some(hash.clone());
  }

  hash
}

/// Calculates the SHA256 hash of the current executable file.
///
/// # Returns
/// Returns the SHA256 hash as a hex string, or an empty string if calculation fails.
fn calculate_executable_hash() -> String {
  match std::env::current_exe() {
    Ok(exe_path) => hash_file(&exe_path),
    Err(_) => {
      log::warn!("Failed to get current executable path");
      String::new()
    }
  }
}

/// Computes the SHA256 hash of a file.
///
/// # Parameters
/// - `path`: The file path to hash
///
/// # Returns
/// Returns the SHA256 hash as a hex string, or an empty string if the file cannot be read.
fn hash_file(path: &PathBuf) -> String {
  match File::open(path) {
    Ok(mut file) => {
      let mut hasher = Sha256::new();
      // Use an 8 KiB buffer as a common compromise between memory usage and I/O throughput.
      let mut buffer = [0; 8192];

      loop {
        match file.read(&mut buffer) {
          Ok(0) => break,
          Ok(n) => hasher.update(&buffer[..n]),
          Err(e) => {
            log::warn!("Error reading executable file for hashing: {}", e);
            return String::new();
          }
        }
      }

      format!("{:x}", hasher.finalize())
    }
    Err(e) => {
      log::warn!("Failed to open executable file for hashing: {}", e);
      String::new()
    }
  }
}
