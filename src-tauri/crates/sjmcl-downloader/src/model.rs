//! 数据模型：Task / TaskGroup / 状态机。

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Task 叶子状态机。
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

/// TaskGroup 控制状态机。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GroupState {
  Queued,
  Active,
  Paused,
  Draining,
  Finished,
}

/// Finished 的细分。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FinishKind {
  Completed,
  Failed,
  Cancelled,
}

/// 错误分类（决定是否自动重试、是否保留 .part）。
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
  /// 瞬态错误（可自动退避重试）：网络错误 + 5xx。
  pub fn is_transient(&self) -> bool {
    match self {
      TaskError::Network(_) => true,
      TaskError::Http(code) => (500..=599).contains(code),
      _ => false,
    }
  }
}

/// 单个执行任务。spec 是 executor 私有参数（JSON），core 不理解含义。
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
  /// 已接收字节（含续传部分）。
  pub received: u64,
  /// 总字节，0 表示未知。
  pub total: u64,
  /// .part 已落盘偏移（断点续传起点）。
  pub offset: u64,
  pub attempts: u32,
  pub error: Option<TaskError>,
  /// 是否实际执行并通过了内容校验。
  #[serde(default)]
  pub verified: bool,
  /// 瞬态错误自动重试是否已耗尽（耗尽才触发组 fail-fast）。
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
  /// 应用重启后是否自动恢复未完成任务。
  pub auto_resume: bool,
  pub state: GroupState,
  pub finish: Option<FinishKind>,
  /// 提交顺序即调度顺序。
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

  /// 所有 task 是否已进入终态。
  pub fn all_terminal(&self) -> bool {
    self.tasks.iter().all(|t| t.state.is_terminal())
  }
}

/// 进度快照（tick 事件与快照命令共用）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
  pub task_id: String,
  pub group_id: String,
  pub state: TaskState,
  pub received: u64,
  pub total: u64,
  /// 瞬时速度 EMA（bytes/s）。
  pub speed_bps: f64,
  pub eta_secs: Option<f64>,
}

/// 引擎配置。
#[derive(Debug, Clone)]
pub struct EngineConfig {
  /// 全局并发上限（worker 数）。
  pub concurrency: usize,
  /// 同时激活的组数上限。
  pub max_active_groups: usize,
  /// 进度事件合并周期。
  pub emit_interval: Duration,
  /// 调度轮询周期。
  pub dispatch_interval: Duration,
  /// worker 内进度回报节流。
  pub report_interval: Duration,
  /// 瞬态错误自动重试次数上限。
  pub max_retries: u32,
  /// 自动重试退避基数（每次 ×2）。
  pub retry_backoff: Duration,
  /// offset 落盘间隔（时间维度）。
  pub offset_flush_interval: Duration,
  /// offset 落盘间隔（字节维度）。
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

/// 引擎级错误（命令拒绝等）。
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

/// 组内控制状态（actor 私有）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CancelReason {
  Pause,
  Cancel,
}

/// task 排队标记：已 push 到 ready channel 等待 worker 领取。
#[derive(Debug, Clone)]
pub(crate) struct RuntimeTask {
  pub start_token: tokio_util::sync::CancellationToken,
  pub run_token: tokio_util::sync::CancellationToken,
  pub queued: bool,
  /// 每 task 的瞬时速度 EMA（actor 内计算）。
  pub speed_ema: f64,
  /// 上一次 emit tick 时的 received（算速度用）。
  pub prev_received: u64,
  pub prev_at: Option<std::time::Instant>,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct RuntimeGroup {
  pub cancel_reason: Option<CancelReason>,
  /// 未持久化的运行期 task 运行时信息。
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
