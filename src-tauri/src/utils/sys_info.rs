use crate::launcher_config::models::MemoryInfo;
use serde_json::json;
use std::path::PathBuf;
use sysinfo::{Disk, Disks};
use systemstat::{saturating_sub_bytes, Platform};
use tauri_plugin_http::reqwest;
use tauri_plugin_os::locale;

/// Sends app version and OS type as statistic data to SJMC asynchronously.
///
/// # Examples
///
/// ```rust
/// send_statistics("1.0.0".to_string(), "windows".to_string()).await;
/// ```
pub async fn send_statistics(version: String, os: String) {
  _ = reqwest::Client::new()
    .post("https://mc.sjtu.cn/api-sjmcl/statistics")
    .json(&json!({
      "version": version,
      "os": os,
    }))
    .send()
    .await;
}

/// Returns a locale identifier standardized for frontend usage
/// by mapping OS-specific locale strings. Defaults to "en" if no match is found.
///
/// # Examples
///
/// ```rust
/// let locale = get_mapped_locale();
/// println!("Locale: {}", locale);
/// ```
pub fn get_mapped_locale() -> String {
  // only apple can do 🌈🧑🏻‍🍳👐🏻
  // The return value of tauri_plugin_os::locale() on macOS(e.g. zh-Hans-CN) differs from that on Windows and Linux(e.g. zh-CN).
  let locale = locale().unwrap();
  let matched_locale;

  #[cfg(target_os = "macos")]
  {
    let language_map = [
      ("fr", vec!["fr"]),
      ("ja", vec!["ja"]),
      ("zh-Hans", vec!["zh-Hans", "wuu-Hans", "yue-Hans"]),
      ("zh-Hant", vec!["zh-Hant", "yue-Hant"]),
    ];

    matched_locale = language_map
      .iter()
      .find(|(_, locales)| locales.iter().any(|l| locale.starts_with(l)))
      .map(|(mapped, _)| mapped.to_string());
  }

  #[cfg(not(target_os = "macos"))]
  {
    let language_map = [
      ("fr", vec!["fr"]),
      ("ja", vec!["ja"]),
      ("zh-Hans", vec!["zh-CN", "zh-SG"]),
      ("zh-Hant", vec!["zh-TW", "zh-HK", "zh-MO"]),
    ];

    matched_locale = language_map
      .iter()
      .find(|(_, locales)| locales.iter().any(|l| locale.starts_with(l)))
      .map(|(mapped, _)| mapped.to_string());
  }

  matched_locale.unwrap_or_else(|| "en".to_string()) // fallback to "en"
}

/// Retrieves system memory information including total, used, and suggested maximum allocation for Minecraft.
/// # Examples
///
/// ```rust
/// let memory_info = get_memory_info();
/// ```
pub fn get_memory_info() -> MemoryInfo {
  // TODO: consider using sysinfo crate to reduce dependency.
  let sys = systemstat::System::new();
  let mem = sys.memory().expect("Failed to retrieve memory info");

  let free = mem.free.as_u64();
  let available = free.saturating_sub(512 * 1024 * 1024); // reserve 512 MB memory

  // Calculate suggested max alloc for Minecraft
  // ref: https://github.com/HMCL-dev/HMCL/blob/4eee79da17140804bdef5995df27a33241bdd328/HMCL/src/main/java/org/jackhuang/hmcl/game/HMCLGameRepository.java#L510
  const THRESHOLD: u64 = 8 * 1024 * 1024 * 1024; // 8 GB
  let suggested_max_alloc = if available <= THRESHOLD {
    available * 4 / 5
  } else {
    THRESHOLD * 4 / 5 + (available - THRESHOLD) / 5
  }
  .min(16 * 1024 * 1024 * 1024);

  MemoryInfo {
    total: mem.total.as_u64(),
    used: saturating_sub_bytes(mem.total, mem.free).as_u64(),
    suggested_max_alloc,
  }
}

/// Get all mounted drive root paths (e.g., "C:\\", "D:\\", "/" on Linux).
///
/// This can be used to scan typical installation directories across all available disks.
///
/// # Example
/// ```
/// let drives = get_all_drive_mount_points();
/// for mount in drives {
///     println!("Drive: {:?}", mount);
/// }
/// ```
pub fn get_all_drive_mount_points() -> Vec<PathBuf> {
  let disks = Disks::new_with_refreshed_list(); // creates and loads disks

  disks
    .list()
    .iter()
    .map(|disk: &Disk| disk.mount_point().to_path_buf())
    .collect()
}
