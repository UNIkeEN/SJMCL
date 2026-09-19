//! The `TaskExecutor` trait lets the core manage task lifecycles without knowing their work.
//! Downloads are the first executor; package operations may register their own executors.
//!
//! A pool of N workers claims jobs from the ready channel. Each worker checks `start_token` when it
//! claims a job and silently drops jobs invalidated while queued. During execution it watches
//! `run_token`.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use crate::{ExecContext, TaskError, TaskOutcome, TaskReport};

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// Executes one task. Implementations report progress and results through `ctx.report`, monitor
/// `ctx.run_token` during their work, and report `Interrupted { offset }` when cancelled.
pub trait TaskExecutor: Send + Sync {
  fn name(&self) -> &'static str;
  fn run(&self, ctx: ExecContext) -> BoxFuture<'static, Result<(), TaskError>>;
}

/// Job entry sent through the ready channel.
pub(crate) struct Job {
  pub ctx: ExecContext,
}

/// Executor registry owned by the actor and queried during dispatch.
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

/// Starts the worker pool and returns `(handles, ready_tx)`.
/// The worker count determines concurrency. The ready channel is bounded at 1024 entries; dispatch
/// uses `try_send` and retries on the next tick when full, guarded by the actor's `queued` flag.
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
    // Check start_token when claiming the job and silently drop jobs invalidated by pause, cancel,
    // or draining while queued. The actor has already updated task state, so no report is needed.
    if job.ctx.start_token.is_cancelled() {
      continue;
    }
    let task_id = job.ctx.task_id.clone();
    // The actor must confirm that the task can still start and record Downloading before execution.
    // This closes the race where fail-fast begins after claim validation but before Started.
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
    // Executors report final results through ctx.report; also report a directly returned error.
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
