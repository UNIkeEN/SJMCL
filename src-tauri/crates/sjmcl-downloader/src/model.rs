//! Task and task-group data models and state machines.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Lifecycle state of an individual task.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskState {
  Pending,
  Downloading,
  Verifying,
  Paused,
  Failed,
  Done,
  Cancelled,
}

impl TaskState {
  pub fn is_terminal(self) -> bool {
    matches!(
      self,
      TaskState::Done | TaskState::Failed | TaskState::Cancelled
    )
  }
}

/// Control state of a task group.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GroupState {
  Queued,
  Active,
  Paused,
  Draining,
  Finished,
}

/// Reason a group reached Finished.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FinishKind {
  Completed,
  Failed,
  Cancelled,
}

/// Error classes let the actor identify failures eligible for automatic retry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Error)]
#[serde(tag = "code", content = "params", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TaskError {
  #[error("network error: {details}")]
  #[serde(rename = "NETWORK_ERROR")]
  Network { details: String },
  #[error("HTTP error: {status}")]
  #[serde(rename = "HTTP_ERROR")]
  Http { status: u16 },
  #[error("I/O error: {details}")]
  #[serde(rename = "IO_ERROR")]
  Io { details: String },
  #[error("checksum mismatch: expected {expected}, got {actual}")]
  #[serde(rename = "CHECKSUM_MISMATCH")]
  Checksum { expected: String, actual: String },
  #[error("corrupt files: {paths:?}")]
  CorruptFiles { paths: Vec<PathBuf> },
  #[error("missing task field: {field}")]
  MissingField { field: String },
  #[error("server returned an invalid Content-Range")]
  InvalidContentRange,
  #[error("resume offset mismatch: expected {expected}, got {actual}")]
  ResumeOffsetMismatch { expected: u64, actual: u64 },
  #[error("unknown error: {details}")]
  #[serde(rename = "OTHER_ERROR")]
  Other { details: String },
  #[error(transparent)]
  #[serde(untagged)]
  Engine(#[from] EngineError),
  /// Application-defined error codes supplied by custom executors.
  #[error("{code}")]
  #[serde(untagged)]
  Application { code: String },
}

impl TaskError {
  /// Transient errors eligible for backoff retries: network errors and recoverable HTTP responses.
  pub fn is_transient(&self) -> bool {
    match self {
      TaskError::Network { .. }
      | TaskError::InvalidContentRange
      | TaskError::ResumeOffsetMismatch { .. } => true,
      TaskError::Http { status } => matches!(*status, 403 | 408 | 429 | 500..=599),
      _ => false,
    }
  }
}

impl From<std::io::Error> for TaskError {
  fn from(error: std::io::Error) -> Self {
    Self::Io {
      details: error.to_string(),
    }
  }
}

impl From<serde_json::Error> for TaskError {
  fn from(error: serde_json::Error) -> Self {
    Self::Other {
      details: error.to_string(),
    }
  }
}

/// One executable task. The core treats spec as executor-specific JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
  pub id: String,
  pub group_id: String,
  pub name: String,
  pub executor: String,
  pub spec: serde_json::Value,
  pub dest: Option<PathBuf>,
  pub sha1: Option<String>,
  pub sha256: Option<String>,
  pub state: TaskState,
  /// Bytes received, including any resumed portion.
  pub received: u64,
  /// Total bytes; zero means unknown.
  pub total: u64,
  /// Last recorded offset; the partial file size takes precedence when resuming.
  pub offset: u64,
  pub attempts: u32,
  pub error: Option<TaskError>,
  /// Whether checksum verification actually ran and succeeded.
  pub verified: bool,
  /// No retry remains, either because it is ineligible or retries were exhausted.
  pub retries_exhausted: bool,
}

impl Task {
  pub fn new(id: String, group_id: String, submit: &crate::SubmitTask) -> Self {
    Task {
      id,
      group_id,
      name: submit.name.clone(),
      executor: submit.executor.clone(),
      spec: submit.spec.clone(),
      dest: submit.dest.clone(),
      sha1: submit.sha1.clone(),
      sha256: submit.sha256.clone(),
      state: TaskState::Pending,
      received: 0,
      total: if submit.executor == "download" {
        submit
          .spec
          .get("size")
          .and_then(|size| size.as_u64())
          .unwrap_or(0)
      } else {
        0
      },
      offset: 0,
      attempts: 0,
      error: None,
      verified: false,
      retries_exhausted: false,
    }
  }
}

#[derive(Debug, Clone)]
pub struct TaskGroup {
  pub id: String,
  pub name: String,
  pub parent_group_id: Option<String>,
  /// Resume unfinished tasks automatically after application restart.
  pub auto_resume: bool,
  pub state: GroupState,
  pub finish: Option<FinishKind>,
  /// A successful completion has not yet been handled by the frontend.
  pub completion_pending: bool,
  /// Task submission order is the scheduling order.
  pub tasks: Vec<Task>,
}

impl TaskGroup {
  pub fn task(&self, id: &str) -> Option<&Task> {
    self.tasks.iter().find(|t| t.id == id)
  }

  pub fn task_mut(&mut self, id: &str) -> Option<&mut Task> {
    self.tasks.iter_mut().find(|t| t.id == id)
  }

  pub fn stats(&self) -> crate::GroupStats {
    let mut s = crate::GroupStats {
      total: self.tasks.len(),
      ..Default::default()
    };
    for t in &self.tasks {
      match t.state {
        TaskState::Done => {
          s.done += 1;
          if t.verified {
            s.verified += 1;
          }
        }
        TaskState::Failed => s.failed += 1,
        TaskState::Cancelled => s.cancelled += 1,
        TaskState::Downloading | TaskState::Verifying => s.downloading += 1,
        TaskState::Pending | TaskState::Paused => s.pending += 1,
      }
    }
    s
  }

  /// Whether every task has reached a terminal state.
  pub fn all_terminal(&self) -> bool {
    self.tasks.iter().all(|t| t.state.is_terminal())
  }
}

/// Progress snapshot shared by Tick events and snapshot queries.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
  pub task_id: String,
  pub group_id: String,
  pub state: TaskState,
  pub received: u64,
  pub total: u64,
  /// Exponential moving average of transfer speed in bytes per second.
  pub speed_bps: f64,
  pub eta_secs: Option<f64>,
}

/// Engine scheduling and retry configuration.
#[derive(Debug, Clone)]
pub struct EngineConfig {
  /// Global concurrency limit, equal to the number of workers.
  pub concurrency: usize,
  /// Maximum number of active groups.
  pub max_active_groups: usize,
  /// Period for batching progress events.
  pub emit_interval: Duration,
  /// Scheduling poll interval.
  pub dispatch_interval: Duration,
  /// Reserved for worker progress reports; configure DownloadExecutor::report_interval instead.
  pub report_interval: Duration,
  /// Automatic retry limit, extended for downloads to try every source at least once.
  pub max_retries: u32,
  /// Base retry delay, doubled after each attempt.
  pub retry_backoff: Duration,
  /// Reserved for time-based offset persistence; currently unused.
  pub offset_flush_interval: Duration,
  /// Reserved for byte-based offset persistence; currently unused.
  pub offset_flush_bytes: u64,
}

impl Default for EngineConfig {
  fn default() -> Self {
    EngineConfig {
      concurrency: 16,
      max_active_groups: 2,
      emit_interval: Duration::from_millis(200),
      dispatch_interval: Duration::from_millis(10),
      report_interval: Duration::from_millis(100),
      max_retries: 3,
      retry_backoff: Duration::from_millis(500),
      offset_flush_interval: Duration::from_secs(2),
      offset_flush_bytes: 512 * 1024,
    }
  }
}

/// Engine-level errors, such as rejected commands.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Error)]
#[serde(
  tag = "code",
  content = "params",
  rename_all = "SCREAMING_SNAKE_CASE",
  rename_all_fields = "camelCase"
)]
pub enum EngineError {
  #[error("unknown group: {group_id}")]
  UnknownGroup { group_id: String },
  #[error("unknown executor: {executor}")]
  UnknownExecutor { executor: String },
  #[error("group {group_id} does not allow this operation in state {state:?}")]
  InvalidState { group_id: String, state: GroupState },
  #[error("a task group must contain at least one task")]
  EmptyGroup,
  #[error("storage error: {details}")]
  #[serde(rename = "STORAGE_ERROR")]
  Storage { details: String },
  #[error("command channel closed")]
  ChannelClosed,
  #[error("download engine is not initialized")]
  EngineNotInitialized,
}

/// Actor-local reason for cancelling a running task.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CancelReason {
  Pause,
  Cancel,
}

/// Runtime state for a task, including whether it is queued for a worker.
#[derive(Debug, Clone)]
pub(crate) struct RuntimeTask {
  pub start_token: tokio_util::sync::CancellationToken,
  pub run_token: tokio_util::sync::CancellationToken,
  pub queued: bool,
  /// Actor-maintained exponential moving average for this task's speed.
  pub speed_ema: f64,
  /// Received-byte count at the previous Tick, used to calculate speed.
  pub prev_received: u64,
  pub prev_at: Option<std::time::Instant>,
}

impl RuntimeTask {
  pub fn update_speed(&mut self, received: u64, now: std::time::Instant) -> f64 {
    if let Some(previous) = self.prev_at
      && received >= self.prev_received
    {
      let elapsed = now.duration_since(previous).as_secs_f64();
      if elapsed >= 0.05 {
        let rate = (received - self.prev_received) as f64 / elapsed;
        // Use a three-second timescale, independent of the progress event frequency.
        let alpha = 1.0 - (-elapsed / 3.0).exp();
        self.speed_ema = if self.speed_ema <= 0.0 {
          rate
        } else {
          self.speed_ema + alpha * (rate - self.speed_ema)
        };
        self.prev_received = received;
        self.prev_at = Some(now);
      }
    } else {
      // Establish a fresh baseline after resumption or a full-download fallback.
      self.speed_ema = 0.0;
      self.prev_received = received;
      self.prev_at = Some(now);
    }
    self.speed_ema
  }
}

#[derive(Debug, Clone, Default)]
pub(crate) struct RuntimeGroup {
  pub cancel_reason: Option<CancelReason>,
  /// Accepted executions that have not yet returned to their worker.
  pub running: HashSet<String>,
  /// Runtime task information, which is not persisted.
  pub tasks: HashMap<String, RuntimeTask>,
  /// Unfinished tasks per execution stage; stages advance only when this count reaches zero.
  pub remaining: BTreeMap<u32, usize>,
  pub nonterminal: usize,
}

impl RuntimeGroup {
  pub fn new() -> Self {
    RuntimeGroup {
      cancel_reason: None,
      running: HashSet::new(),
      tasks: HashMap::new(),
      remaining: BTreeMap::new(),
      nonterminal: 0,
    }
  }
}
