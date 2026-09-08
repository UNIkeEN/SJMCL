//! 事件定义 + EventSink trait（core 与 tauri 的解耦点）。
//!
//! 规则：只有 actor 能 emit；高频进度合并为一个 Tick；状态/错误即时发。

use crate::model::{FinishKind, GroupState, Progress, TaskError, TaskState};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(
  tag = "kind",
  rename_all = "snake_case",
  rename_all_fields = "camelCase"
)]
pub enum EngineEvent {
  /// 200ms 合并一次的进度快照（唯一高频事件）。
  Tick(Vec<Progress>),
  /// 新任务组已持久化；即使仍在排队，前端也应立即刷新快照。
  GroupSubmitted { group_id: String },
  /// task 状态切换（低频，即时）。
  TaskStateChanged {
    group_id: String,
    task_id: String,
    old: TaskState,
    new: TaskState,
  },
  /// 组状态切换。
  GroupStateChanged {
    group_id: String,
    old: GroupState,
    new: GroupState,
  },
  /// 组终结汇报（drain 完成或 cancel/complete）。
  GroupFinished {
    group_id: String,
    finish: FinishKind,
    failed_tasks: Vec<String>,
    summary: crate::GroupStats,
  },
  /// task 失败即时上报（触发组 Draining 时前端第一时间看到）。
  TaskFailed {
    group_id: String,
    task_id: String,
    error: TaskError,
  },
  /// 校验通过（低频）。
  TaskVerified { group_id: String, task_id: String },
}

/// 事件出口。tauri 适配器实现为 `AppHandle::emit`；测试可打印或收集。
pub trait EventSink: Send + Sync {
  fn emit(&self, ev: &EngineEvent);
}

impl EventSink for Box<dyn EventSink> {
  fn emit(&self, ev: &EngineEvent) {
    (**self).emit(ev)
  }
}

/// 空实现（调试用）。
pub struct NoopSink;
impl EventSink for NoopSink {
  fn emit(&self, _ev: &EngineEvent) {}
}
