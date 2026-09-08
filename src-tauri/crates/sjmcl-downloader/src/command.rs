//! Commands sent to the actor. Snapshot, submission, and control commands
//! use one-shot replies.
//! RetryTask is an internal delayed command used for transient failures.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::model::EngineError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitTask {
  pub name: String,
  /// Registered executor name, such as "download".
  pub executor: String,
  /// Executor-specific arguments. The download executor expects { "url": "..." }.
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
  /// Resume unfinished tasks after an application restart; otherwise wait for an explicit resume.
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
  /// Internal delayed retry of a task after a transient failure.
  RetryTask {
    group_id: String,
    task_id: String,
  },
  /// Complete snapshot used to initialize frontend state.
  Snapshot(tokio::sync::oneshot::Sender<Vec<crate::GroupSummary>>),
  /// Task details for one group.
  ListTasks {
    group_id: String,
    reply: Reply<Vec<crate::model::Task>>,
  },
}
