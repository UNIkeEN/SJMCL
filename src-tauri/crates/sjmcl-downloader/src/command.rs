//! Input commands for the actor. Commands requiring a response use oneshot channels for snapshots,
//! submissions, and control acknowledgements. `RetryTask` schedules an internal delayed retry.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::model::EngineError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitTask {
  pub name: String,
  /// Registered executor name, such as "download".
  pub executor: String,
  /// Executor-specific parameters. Download executor: `{ "url": "..." }`.
  pub spec: serde_json::Value,
  pub dest: Option<PathBuf>,
  pub sha1: Option<String>,
  pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitGroup {
  pub name: String,
  pub tasks: Vec<SubmitTask>,
  /// Whether to resume automatically after an application restart; otherwise restored as Paused.
  pub auto_resume: bool,
}

pub type Reply<T> = tokio::sync::oneshot::Sender<Result<T, EngineError>>;

#[derive(Debug)]
pub enum Command {
  SubmitGroup(SubmitGroup, Reply<String>),
  Pause {
    group_id: String,
    reply: Reply<()>,
  },
  Resume {
    group_id: String,
    reply: Reply<()>,
  },
  Cancel {
    group_id: String,
    reply: Reply<()>,
  },
  Retry {
    group_id: String,
    reply: Reply<()>,
  },
  Remove {
    group_id: String,
    reply: Reply<()>,
  },
  /// Internal command that retries one task after a transient failure.
  RetryTask {
    group_id: String,
    task_id: String,
  },
  /// Complete snapshot used to initialize frontend state on mount.
  Snapshot(tokio::sync::oneshot::Sender<Vec<crate::GroupSummary>>),
  /// Task details for a group.
  ListTasks {
    group_id: String,
    reply: Reply<Vec<crate::model::Task>>,
  },
}
