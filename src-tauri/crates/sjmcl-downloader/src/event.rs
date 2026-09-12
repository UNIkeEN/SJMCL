//! Event definitions and the `EventSink` trait that decouples the core from Tauri.
//!
//! Only the actor emits events. Frequent progress updates are coalesced into a Tick, while state
//! changes and errors are emitted immediately.

use crate::model::{FinishKind, GroupState, Progress, TaskError, TaskState};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(
  tag = "kind",
  rename_all = "snake_case",
  rename_all_fields = "camelCase"
)]
pub enum EngineEvent {
  /// Progress snapshot coalesced every 200 ms, the only high-frequency event.
  Tick(Vec<Progress>),
  /// A new task group was persisted. The frontend should refresh even if the group is still queued.
  GroupSubmitted { group_id: String },
  /// Immediate, low-frequency task state change.
  TaskStateChanged {
    group_id: String,
    task_id: String,
    old: TaskState,
    new: TaskState,
  },
  /// Task group state change.
  GroupStateChanged {
    group_id: String,
    old: GroupState,
    new: GroupState,
  },
  /// Task group completion after draining, cancellation, or successful completion.
  GroupFinished {
    group_id: String,
    finish: FinishKind,
    failed_tasks: Vec<String>,
    summary: crate::GroupStats,
  },
  /// Immediate task failure report so the frontend sees a group entering Draining promptly.
  TaskFailed {
    group_id: String,
    task_id: String,
    error: TaskError,
  },
  /// Low-frequency verification success event.
  TaskVerified { group_id: String, task_id: String },
}

/// Event output implemented with `AppHandle::emit` in Tauri and printable or collectable in tests.
pub trait EventSink: Send + Sync {
  fn emit(&self, ev: &EngineEvent);
}

impl EventSink for Box<dyn EventSink> {
  fn emit(&self, ev: &EngineEvent) {
    (**self).emit(ev)
  }
}

/// No-op implementation for debugging.
pub struct NoopSink;
impl EventSink for NoopSink {
  fn emit(&self, _ev: &EngineEvent) {}
}
