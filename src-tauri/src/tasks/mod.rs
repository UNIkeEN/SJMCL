pub mod background;
pub mod commands;
pub mod download;
pub mod events;
pub mod monitor;
pub mod streams;

use download::DownloadParam;
use events::TauriEventSink;
use serde::{Deserialize, Serialize};
use sjmcl_types::error::SJMCLResult;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, RwLock};
use streams::{GDesc, PDesc, PHandle};
use tokio::time::Duration;

pub type SJMCLBoxedFuture = Pin<Box<dyn Future<Output = SJMCLResult<()>> + Send>>;

pub struct SJMCLFuture {
  pub task_id: u32,
  pub task_group: Option<String>,
  pub f: SJMCLBoxedFuture,
}

pub struct SJMCLFutureDesc {
  pub task_id: u32,
  pub f: SJMCLBoxedFuture,
  pub h: Arc<RwLock<PTaskHandle>>,
}

type PTaskHandle = PHandle<TauriEventSink, PTaskParam>;
type PTaskDesc = PDesc<PTaskParam>;
type PTaskGroupDesc = GDesc<PTaskParam>;

#[derive(Serialize, Deserialize, Clone)]
pub struct THandle {
  #[serde(default)]
  pub task_id: u32,
  pub task_group: Option<String>,
  pub task_type: String,
  pub state: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "taskType", rename_all = "camelCase")]
pub enum PTaskParam {
  Download(DownloadParam),
}

/// Identity of a task, used to detect work that is already queued or running.
///
/// Every producer of download params (instance install, mod-loader refresh,
/// modpack import, resource download, Java install, updater) can be re-entered
/// while a previous run is still in flight. Comparing this key lets the
/// scheduler collapse duplicates at one place instead of each caller growing its
/// own ad-hoc guard. Two tasks are duplicates when they write the same bytes to
/// the same place; the source list is deliberately excluded so a retry that
/// rotates to a mirror is still recognised as the same work.
pub trait TaskKey {
  fn task_key(&self) -> String;
}

impl TaskKey for PTaskParam {
  fn task_key(&self) -> String {
    match self {
      PTaskParam::Download(p) => format!("download:{}", normalize_path_key(&p.dest)),
    }
  }
}

/// Canonical form of a destination path for identity comparison.
///
/// The same file is reached through different spellings: `a/../b`, mixed
/// separators, and differing case on Windows. Two entries must compare equal
/// even when they came from different producers, otherwise the dedup silently
/// lets a duplicate through.
fn normalize_path_key(path: &std::path::Path) -> String {
  let mut key = path.to_string_lossy().replace('\\', "/");
  // Collapse `.` and `..` without touching the filesystem (the file may not
  // exist yet — this runs before the download starts).
  let mut out: Vec<&str> = Vec::new();
  let absolute =
    key.starts_with('/') || key.chars().nth(1).is_some_and(|c| c == ':') || key.starts_with("//");
  for part in key.split('/') {
    match part {
      "" | "." => {}
      ".." => {
        if out.last().is_some_and(|p| !p.is_empty() && *p != "..") {
          out.pop();
        } else if !absolute {
          out.push("..");
        }
      }
      other => out.push(other),
    }
  }
  key = if absolute {
    format!("/{}", out.join("/"))
  } else {
    out.join("/")
  };
  // Windows paths are case-insensitive; Linux ones are not. Compare on the
  // platform's own terms so a duplicate is never missed locally.
  if cfg!(windows) {
    key.to_lowercase()
  } else {
    key
  }
}
