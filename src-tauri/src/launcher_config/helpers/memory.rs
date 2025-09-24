use crate::launcher_config::models::MemoryInfo;
use systemstat::{saturating_sub_bytes, Platform};

pub fn get_memory_info() -> MemoryInfo {
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
