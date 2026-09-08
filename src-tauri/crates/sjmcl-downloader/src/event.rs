//! Engine events and the EventSink boundary between the core and Tauri.
//!
//! Only the actor emits events. Progress is batched into Tick;
//! state changes and errors emit immediately.

use crate::model::{FinishKind, GroupState, Progress, TaskError, TaskState};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(
  tag = "kind",
  rename_all = "snake_case",
  rename_all_fields = "camelCase"
)]
pub enum EngineEvent {
  /// Batched progress snapshot; the only frequent event. Its period is configured by emit_interval.
  Tick(Vec<Progress>),
  /// A new group was persisted. The frontend should refresh even if it is still queued.
  GroupSubmitted { group_id: String },
  /// Task state changed; emitted immediately.
  TaskStateChanged {
    group_id: String,
    task_id: String,
    old: TaskState,
    new: TaskState,
  },
  /// Group state changed.
  GroupStateChanged {
    group_id: String,
    old: GroupState,
    new: GroupState,
  },
  /// Final group report after draining, cancellation, or completion.
  GroupFinished {
    group_id: String,
    finish: FinishKind,
    failed_tasks: Vec<String>,
    summary: crate::GroupStats,
  },
  /// Report task failures immediately when they are observed.
  TaskFailed {
    group_id: String,
    task_id: String,
    error: TaskError,
  },
  /// Task checksum verification succeeded.
  TaskVerified { group_id: String, task_id: String },
}

/// Event output. The Tauri adapter calls AppHandle::emit; tests can print or collect events.
pub trait EventSink: Send + Sync {
  fn emit(&self, ev: &EngineEvent);
}

impl EventSink for Box<dyn EventSink> {
  fn emit(&self, ev: &EngineEvent) {
    (**self).emit(ev)
  }
}

/// No-op sink for tests and debugging.
pub struct NoopSink;
impl EventSink for NoopSink {
  fn emit(&self, _ev: &EngineEvent) {}
}
