//! Data models for tasks, task groups, and their state machines.

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// State machine for an individual task.
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

/// Control state machine for a task group.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GroupState {
  Queued,
  Active,
  Paused,
  Draining,
  Finished,
}

/// Detailed outcome of a finished task group.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FinishKind {
  Completed,
  Failed,
  Cancelled,
}

/// Error categories that determine automatic retries and `.part` file retention.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Error)]
pub enum TaskError {
  #[error("网络错误: {0}")]
  Network(String),
  #[error("HTTP 错误: {0}")]
  Http(u16),
  #[error("IO 错误: {0}")]
  Io(String),
  #[error("校验失败: 期望 {expected}, 实际 {actual}")]
  Checksum { expected: String, actual: String },
  #[error("未知: {0}")]
  Other(String),
}

impl TaskError {
  /// Whether this is a transient error eligible for automatic backoff retries.
  pub fn is_transient(&self) -> bool {
    match self {
      TaskError::Network(_) => true,
      TaskError::Http(code) => (500..=599).contains(code),
      _ => false,
    }
  }
}

/// An individual task. `spec` contains executor-specific JSON opaque to the core.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
  pub id: String,
  #[serde(alias = "group_id")]
  pub group_id: String,
  pub name: String,
  pub executor: String,
  pub spec: serde_json::Value,
  pub dest: Option<PathBuf>,
  #[serde(default)]
  pub sha1: Option<String>,
  pub sha256: Option<String>,
  pub state: TaskState,
  /// Bytes received, including bytes from an earlier partial download.
  pub received: u64,
  /// Total bytes, or zero if unknown.
  pub total: u64,
  /// Persisted `.part` offset from which to resume.
  pub offset: u64,
  pub attempts: u32,
  pub error: Option<TaskError>,
  /// Whether the task ran and passed content verification.
  #[serde(default)]
  pub verified: bool,
  /// Whether transient-error retries are exhausted, which triggers group fail-fast.
  #[serde(default, alias = "retries_exhausted")]
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
      total: 0,
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
  /// Whether to resume unfinished tasks automatically after an application restart.
  pub auto_resume: bool,
  pub state: GroupState,
  pub finish: Option<FinishKind>,
  /// Tasks are scheduled in submission order.
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

/// Progress snapshot shared by tick events and snapshot commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
  pub task_id: String,
  pub group_id: String,
  pub state: TaskState,
  pub received: u64,
  pub total: u64,
  /// Exponential moving average of the current speed in bytes per second.
  pub speed_bps: f64,
  pub eta_secs: Option<f64>,
}

/// Engine configuration.
#[derive(Debug, Clone)]
pub struct EngineConfig {
  /// Global concurrency limit, expressed as the number of workers.
  pub concurrency: usize,
  /// Maximum number of simultaneously active groups.
  pub max_active_groups: usize,
  /// Interval for coalescing progress events.
  pub emit_interval: Duration,
  /// Scheduler polling interval.
  pub dispatch_interval: Duration,
  /// Per-worker progress reporting interval.
  pub report_interval: Duration,
  /// Maximum automatic retry count for transient errors.
  pub max_retries: u32,
  /// Base automatic retry delay, doubled after each attempt.
  pub retry_backoff: Duration,
  /// Time interval for persisting offsets.
  pub offset_flush_interval: Duration,
  /// Byte interval for persisting offsets.
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
#[derive(Debug, Error)]
pub enum EngineError {
  #[error("未知组: {0}")]
  UnknownGroup(String),
  #[error("未知 executor: {0}")]
  UnknownExecutor(String),
  #[error("组 {0} 当前状态不允许该操作")]
  InvalidState(String),
  #[error("提交参数无效: {0}")]
  InvalidSubmission(String),
  #[error("命令通道已关闭")]
  ChannelClosed,
}

/// Actor-private control state for a task group.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CancelReason {
  Pause,
  Cancel,
}

/// Marks a task pushed to the ready channel and waiting for a worker.
#[derive(Debug, Clone)]
pub(crate) struct RuntimeTask {
  pub start_token: tokio_util::sync::CancellationToken,
  pub run_token: tokio_util::sync::CancellationToken,
  pub queued: bool,
  /// Per-task speed EMA calculated by the actor.
  pub speed_ema: f64,
  /// Received byte count at the previous emit tick, used to calculate speed.
  pub prev_received: u64,
  pub prev_at: Option<std::time::Instant>,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct RuntimeGroup {
  pub cancel_reason: Option<CancelReason>,
  /// Non-persisted runtime state for each task.
  pub tasks: HashMap<String, RuntimeTask>,
}

impl RuntimeGroup {
  pub fn new() -> Self {
    RuntimeGroup {
      cancel_reason: None,
      tasks: HashMap::new(),
    }
  }
}
