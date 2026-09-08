//! actor 输入命令。带回复的用 oneshot（快照/提交/控制确认），
//! RetryTask 是 actor 给自己发的内部延迟命令（瞬态错误自动重试）。

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::model::EngineError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitTask {
  pub name: String,
  /// executor 注册名，如 "download"。
  pub executor: String,
  /// executor 私有参数。download executor: { "url": "..." }
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
  /// 应用重启后是否自动恢复（否则恢复为 Paused 等用户 resume）。
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
  /// 内部：瞬态失败后延迟重试单任务。
  RetryTask {
    group_id: String,
    task_id: String,
  },
  /// 全量快照（前端挂载时灌状态）。
  Snapshot(tokio::sync::oneshot::Sender<Vec<crate::GroupSummary>>),
  /// 组内 task 明细。
  ListTasks {
    group_id: String,
    reply: Reply<Vec<crate::model::Task>>,
  },
}
