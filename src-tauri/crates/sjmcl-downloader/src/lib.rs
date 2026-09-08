//! SJMCL 下载引擎及其 Tauri 适配层。
//!
//! 架构：Actor 模式。`EngineActor` 是单一事件循环，持有全部状态；
//! 执行单元（worker）通过 channel 回报，前端通过命令 + 事件双通道访问。
//!
//! 语义：TaskGroup 是唯一控制面（pause/resume/cancel/retry 均组级）；
//! 任一 task 失败 → 组进入 Draining（fail-fast）：不再调度新任务、
//! in-flight 排水跑完、未开始的 Pending → Cancelled，随后 Finished(Failed) 汇报。

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

/// 引擎查询结果：组摘要（前端挂载时拉全量用）。
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

/// 引擎内部执行上下文（actor 克隆数据给 worker，不借用引擎）。
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
  /// 排队→领取阶段令牌（pause/cancel/draining 会取消它）。
  pub start_token: tokio_util::sync::CancellationToken,
  /// 执行中令牌（pause/cancel 会取消它，draining 不会）。
  pub run_token: tokio_util::sync::CancellationToken,
  pub report: tokio::sync::mpsc::Sender<TaskReport>,
}

/// worker → actor 的回传通道（唯一出口，事件只有 actor 能发）。
#[derive(Debug)]
pub enum TaskReport {
  /// worker 领取任务后请求 actor 确认；actor 先落 Downloading，再允许执行。
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
  /// 正常完成（含校验通过）。
  Done { verified: bool },
  /// 校验失败（已删 .part）。
  ChecksumFailed { expected: String, actual: String },
  /// 失败（网络/HTTP/IO）。
  Failed { error: TaskError },
  /// 被 token 中断，offset 为已写字节（暂停保留 .part，取消由 actor 删）。
  Interrupted { offset: u64 },
}
