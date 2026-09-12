//! SJMCL download engine and its Tauri adapter.
//!
//! Architecture: `EngineActor` is the sole event loop and owns all state. Workers report through
//! channels, while the frontend communicates through commands and events.
//!
//! Semantics: `TaskGroup` is the sole control surface; pause, resume, cancel, and retry all operate
//! at group level. Any task failure puts its group into Draining: no new tasks are scheduled,
//! in-flight tasks finish, pending tasks become Cancelled, then the group reports Finished(Failed).

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
pub use tauri::{EngineHandle, EngineRuntime, commands, init, init_with_db_path, setup_engine};

/// Engine query result containing group summaries used to initialize the frontend.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupSummary {
  pub id: String,
  pub name: String,
  pub state: GroupState,
  pub finish: Option<FinishKind>,
  pub stats: GroupStats,
}

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

/// Internal execution context cloned by the actor for workers without borrowing the engine.
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
  /// Token for the queued-to-claimed phase, cancelled by pause, cancel, or draining.
  pub start_token: tokio_util::sync::CancellationToken,
  /// In-flight token, cancelled by pause or cancel but not by draining.
  pub run_token: tokio_util::sync::CancellationToken,
  pub report: tokio::sync::mpsc::Sender<TaskReport>,
}

/// Worker-to-actor report channel, the sole output path because only the actor emits events.
#[derive(Debug)]
pub enum TaskReport {
  /// A worker asks the actor to confirm a claimed task. The actor records Downloading first.
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
  /// Completed successfully, including content verification.
  Done { verified: bool },
  /// Content verification failed and the `.part` file was removed.
  ChecksumFailed { expected: String, actual: String },
  /// Failed due to a network, HTTP, or I/O error.
  Failed { error: TaskError },
  /// Interrupted by a token. `offset` is the byte count written; pause retains `.part`, while the
  /// actor removes it on cancellation.
  Interrupted { offset: u64 },
}
