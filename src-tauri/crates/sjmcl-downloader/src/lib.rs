//! SJMCL download engine and its Tauri adapter.
//!
//! The EngineActor owns all mutable engine state in a single event loop.
//! Workers report through a channel; the frontend uses commands and events.
//!
//! TaskGroup is the control unit for pause, resume, cancel, and retry.
//! A terminal task failure moves the group to Draining: no new work starts,
//! in-flight tasks finish, pending tasks are cancelled, then Finished(Failed) is emitted.

pub mod actor;
pub mod command;
pub mod download;
pub mod event;
pub mod executor;
pub mod model;
pub mod rate;
pub mod storage;
pub mod tauri;

pub use actor::{Engine, EngineBuilder};
pub use command::{Command, SubmitGroup, SubmitTask};
pub use event::{EngineEvent, EventSink};
pub use executor::TaskExecutor;
pub use model::{
  EngineConfig, EngineError, FinishKind, GroupState, Progress, Task, TaskError, TaskGroup,
  TaskState,
};
pub use rate::TokenBucket;
pub use storage::StateStore;
pub use tauri::{commands, init, init_with_db_path, setup_engine, EngineHandle, EngineRuntime};

/// Summary returned by engine queries, including the initial frontend snapshot.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupSummary {
  pub id: String,
  pub name: String,
  pub state: GroupState,
  pub finish: Option<FinishKind>,
  pub stats: GroupStats,
}

/// Group counts used by the frontend; done and total count tasks, not bytes.
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupStats {
  pub total: usize,
  pub done: usize,
  pub failed: usize,
  pub cancelled: usize,
  pub downloading: usize,
  pub pending: usize,
  pub verified: usize,
}

/// Execution context cloned by the actor for a worker; it does not borrow engine state.
#[derive(Debug)]
pub struct ExecContext {
  pub task_id: String,
  pub group_id: String,
  pub name: String,
  pub executor: String,
  pub spec: serde_json::Value,
  pub dest: Option<std::path::PathBuf>,
  pub sha1: Option<String>,
  pub sha256: Option<String>,
  pub resume_offset: u64,
  /// Token for the queued-to-start phase; pause, cancel, and draining invalidate it.
  pub start_token: tokio_util::sync::CancellationToken,
  /// Token for active execution; pause and cancel invalidate it, but draining does not.
  pub run_token: tokio_util::sync::CancellationToken,
  pub report: tokio::sync::mpsc::Sender<TaskReport>,
}

/// Worker-to-actor reports. Only the actor emits external events.
#[derive(Debug)]
pub enum TaskReport {
  /// Ask the actor to commit Downloading before the worker starts execution.
  StartRequested {
    task_id: String,
    start_token: tokio_util::sync::CancellationToken,
    reply: tokio::sync::oneshot::Sender<bool>,
  },
  Progress {
    task_id: String,
    received: u64,
    total: u64,
  },
  Verifying {
    task_id: String,
  },
  Outcome {
    task_id: String,
    outcome: TaskOutcome,
  },
}

#[derive(Debug)]
pub enum TaskOutcome {
  /// Completed successfully, including any requested checksum verification.
  Done { verified: bool },
  /// Checksum verification failed; the partial file was removed.
  ChecksumFailed { expected: String, actual: String },
  /// Network, HTTP, or I/O failure.
  Failed { error: TaskError },
  /// Interrupted by the run token. Pause keeps the partial file;
  /// cancellation removes it in the actor.
  Interrupted { offset: u64 },
}
