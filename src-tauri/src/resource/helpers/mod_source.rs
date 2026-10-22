//! Mirror-source handling for the mod/resource APIs, mirroring PCL's
//! `DlSourceModGet` (`ModDownload.vb:1305`).
//!
//! The official CurseForge API rejects requests without a valid `x-api-key`,
//! which makes the CurseForge source unusable for anyone who has not configured
//! a key of their own. The MCIM mirror forwards to CurseForge using its own
//! key, so the same request succeeds without one — the client only has to send
//! it to a different host.
//!
//! Only the host is rewritten; the path and query are preserved, so the mirror
//! is a drop-in endpoint for every request the official API accepts.

use crate::launcher_config::models::LauncherConfig;

/// Ordering preference for official vs. mirror source.
///
/// Mirrors PCL's `ToolDownloadMod` setting (`PageSetupSystem.xaml:64`). The
/// launcher's own source setting has three values, mapped here:
///
/// * `mirror` → prefer the mirror (PCL's option 0);
/// * `official` → try official first but fall back to the mirror on the first
///   stumble, rather than giving official a second long attempt (PCL's option 1);
/// * `auto` → mirror first for mainland IPs, otherwise official.
///
/// The mirror can lag behind the official API on very recent uploads, which is
/// why it is a fallback rather than the default.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModSourceStrategy {
  PreferMirror,
  OfficialFirst,
  PreferOfficial,
}

impl ModSourceStrategy {
  fn from_config(config: &LauncherConfig) -> Self {
    match config.download.source.strategy.as_str() {
      "mirror" => ModSourceStrategy::PreferMirror,
      // "official" means the user wants official data, but not at the cost of
      // waiting: one short probe, then the mirror gets its turn immediately.
      "official" => ModSourceStrategy::OfficialFirst,
      // "auto" keeps the IP-based behaviour of `get_source_priority_list`:
      // mainland users reach the mirror, others reach the official API.
      "auto" => match config.basic_info.is_china_mainland_ip {
        true => ModSourceStrategy::PreferMirror,
        false => ModSourceStrategy::PreferOfficial,
      },
      _ => ModSourceStrategy::PreferOfficial,
    }
  }
}

/// Rewrite an official mod-API URL to the MCIM mirror. Returns `None` when the
/// URL is not one the mirror covers, so callers can skip it cleanly.
pub fn to_mirror_url(url: &str) -> Option<String> {
  // Order matters: the more specific host must be replaced before the shorter
  // one that prefixes it, otherwise `api.modrinth.com` would be mangled by the
  // plain `modrinth.com` rule.
  const REPLACEMENTS: &[(&str, &str)] = &[
    (
      "https://api.modrinth.com",
      "https://mod.mcimirror.top/modrinth",
    ),
    (
      "https://staging-api.modrinth.com",
      "https://mod.mcimirror.top/modrinth",
    ),
    ("https://cdn.modrinth.com", "https://mod.mcimirror.top"),
    (
      "https://api.curseforge.com",
      "https://mod.mcimirror.top/curseforge",
    ),
    ("https://edge.forgecdn.net", "https://mod.mcimirror.top"),
    (
      "https://mediafilez.forgecdn.net",
      "https://mod.mcimirror.top",
    ),
    ("https://media.forgecdn.net", "https://mod.mcimirror.top"),
  ];

  for (from, to) in REPLACEMENTS {
    if url.starts_with(from) {
      return Some(format!("{}{}", to, &url[from.len()..]));
    }
  }
  None
}

/// A (url, timeout) candidate, mirroring PCL's queue entries in `DlModRequest`.
pub struct SourceCandidate {
  pub url: String,
  pub timeout_ms: u64,
}

/// Build the ordered list of sources to try for one request.
///
/// Mirrors PCL's `DlModRequest` (`ModDownload.vb:1176`): each source is given a
/// short probe attempt and then a longer one before moving on, because a
/// hanging-but-alive host must not consume the whole budget in one go. Modrinth
/// needs a longer first timeout than CurseForge — PCL uses 20s vs 10s for
/// exactly this reason.
pub fn source_candidates(
  url: &str,
  is_modrinth: bool,
  config: &LauncherConfig,
) -> Vec<SourceCandidate> {
  let strategy = ModSourceStrategy::from_config(config);
  let mirror = to_mirror_url(url);
  let short = if is_modrinth { 20_000 } else { 10_000 };
  let long = 30_000;

  match mirror {
    None => vec![
      SourceCandidate {
        url: url.to_string(),
        timeout_ms: short,
      },
      SourceCandidate {
        url: url.to_string(),
        timeout_ms: long,
      },
    ],
    Some(mirror) => match strategy {
      ModSourceStrategy::PreferMirror => vec![
        SourceCandidate {
          url: mirror.clone(),
          timeout_ms: 10_000,
        },
        SourceCandidate {
          url: mirror,
          timeout_ms: 10_000,
        },
        SourceCandidate {
          url: url.to_string(),
          timeout_ms: long,
        },
      ],
      ModSourceStrategy::OfficialFirst => vec![
        SourceCandidate {
          url: url.to_string(),
          timeout_ms: short,
        },
        SourceCandidate {
          url: mirror.clone(),
          timeout_ms: 10_000,
        },
        SourceCandidate {
          url: url.to_string(),
          timeout_ms: long,
        },
        SourceCandidate {
          url: mirror,
          timeout_ms: long,
        },
      ],
      ModSourceStrategy::PreferOfficial => vec![
        SourceCandidate {
          url: url.to_string(),
          timeout_ms: short,
        },
        SourceCandidate {
          url: url.to_string(),
          timeout_ms: long,
        },
        SourceCandidate {
          url: mirror,
          timeout_ms: long,
        },
      ],
    },
  }
}
