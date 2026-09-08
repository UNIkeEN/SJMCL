//! TaskExecutor trait：core 只关心 task 生命周期，不关心 task 干什么。
//! 下载只是第一个 executor；包管理操作（安装/校验/脚本）可注册自己的 executor。
//!
//! worker 池：N 个 worker 从 ready channel 领取 job；领取时校验 start_token
//! （排队期间被 pause/cancel/draining 淘汰的 job 静默丢弃），执行中监听 run_token。

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use crate::{ExecContext, TaskError, TaskOutcome, TaskReport};

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// 执行一个 task。实现方：
/// - 通过 `ctx.report` 回报进度与结果
/// - 下载循环中 `select!` 监听 `ctx.run_token`，中断时回报 `Interrupted { offset }`
pub trait TaskExecutor: Send + Sync {
  fn name(&self) -> &'static str;
  fn run(&self, ctx: ExecContext) -> BoxFuture<'static, Result<(), TaskError>>;
}

/// ready channel 里的 job 条目。
pub(crate) struct Job {
  pub ctx: ExecContext,
}

/// executor 注册表（actor 持有，dispatch 时查找）。
pub trait ExecutorRegistry: Send + Sync {
  fn get(&self, name: &str) -> Option<Arc<dyn TaskExecutor>>;
}

pub(crate) struct Registry {
  map: std::collections::HashMap<String, Arc<dyn TaskExecutor>>,
}

impl Registry {
  pub fn new() -> Self {
    Registry {
      map: std::collections::HashMap::new(),
    }
  }
  pub fn insert(&mut self, ex: Arc<dyn TaskExecutor>) {
    self.map.insert(ex.name().to_string(), ex);
  }
}

impl ExecutorRegistry for Registry {
  fn get(&self, name: &str) -> Option<Arc<dyn TaskExecutor>> {
    self.map.get(name).map(Arc::clone)
  }
}

/// 启动 worker 池，返回 (handles, ready_tx)。
/// 并发上限由 worker 数量决定；ready channel 有界（1024），
/// dispatch 用 try_send，满则下个 dispatch tick 再推（actor 内 `queued` 标记防重推）。
pub(crate) fn spawn_worker_pool(
  executors: Arc<dyn ExecutorRegistry>,
  concurrency: usize,
) -> (Vec<tokio::task::JoinHandle<()>>, async_channel::Sender<Job>) {
  let (tx, rx) = async_channel::bounded(1024);
  let concurrency = concurrency.max(1);
  let mut handles = Vec::with_capacity(concurrency);
  for _ in 0..concurrency {
    let rx = rx.clone();
    let ex = Arc::clone(&executors);
    handles.push(tokio::spawn(async move { worker_loop(ex, rx).await }));
  }
  (handles, tx)
}

async fn worker_loop(executors: Arc<dyn ExecutorRegistry>, rx: async_channel::Receiver<Job>) {
  while let Ok(job) = rx.recv().await {
    // 领取时校验 start_token：排队期间被淘汰（pause/cancel/draining）→ 静默丢弃。
    // actor 已同步更新 task 状态，这里无需回报。
    if job.ctx.start_token.is_cancelled() {
      continue;
    }
    let task_id = job.ctx.task_id.clone();
    // actor 必须先确认任务仍可启动并落下 Downloading 状态，executor 才能运行。
    // 这关闭了“领取检查通过、但 Started 尚未处理时发生 fail-fast”的竞态窗口。
    let (start_reply, start_confirmed) = tokio::sync::oneshot::channel();
    if job
      .ctx
      .report
      .send(TaskReport::StartRequested {
        task_id: task_id.clone(),
        start_token: job.ctx.start_token.clone(),
        reply: start_reply,
      })
      .await
      .is_err()
    {
      continue;
    }
    if start_confirmed.await != Ok(true) {
      continue;
    }
    let Some(ex) = executors.get(&job.ctx.executor) else {
      let _ = job
        .ctx
        .report
        .send(TaskReport::Outcome {
          task_id,
          outcome: TaskOutcome::Failed {
            error: TaskError::Other(format!("未知 executor: {}", job.ctx.executor)),
          },
        })
        .await;
      continue;
    };
    // executor 内部通过 ctx.report 回报最终结果；直接返回的 Err 也在此兜底回报
    let report = job.ctx.report.clone();
    if let Err(error) = ex.run(job.ctx).await {
      let _ = report
        .send(TaskReport::Outcome {
          task_id,
          outcome: TaskOutcome::Failed { error },
        })
        .await;
    }
  }
}
