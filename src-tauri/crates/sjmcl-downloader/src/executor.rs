//! TaskExecutor defines task execution independently of the core lifecycle.
//! Download is the first executor; other operations can register their own implementation.
//!
//! Workers receive jobs from the ready channel and check start_token before starting.
//! Jobs invalidated while queued are discarded; active execution observes run_token.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use crate::{ExecContext, TaskError, TaskOutcome, TaskReport};

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// Execute a task. Implementations should:
/// - report progress and final outcomes through ctx.report;
/// - observe ctx.run_token and report Interrupted with the written offset.
pub trait TaskExecutor: Send + Sync {
  fn name(&self) -> &'static str;
  /// Higher stages start after every task in the preceding stages succeeds.
  fn postprocess_order(&self) -> u32 {
    0
  }
  fn run(&self, ctx: ExecContext) -> BoxFuture<'static, Result<(), TaskError>>;
}

/// Job queued on the ready channel.
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

/// Start the worker pool and return worker handles and the ready sender.
/// The worker count limits concurrency. The ready channel holds at most 1024 jobs.
/// Dispatch uses try_send and retries on the next tick when full; queued prevents duplicates.
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
    // Discard jobs invalidated by pause, cancel, or draining while they were queued.
    // The actor has already updated their task states, so no report is needed.
    if job.ctx.start_token.is_cancelled() {
      continue;
    }
    let task_id = job.ctx.task_id.clone();
    // The actor must commit Downloading before the executor can run.
    // This closes the race between the worker's token check and a fail-fast transition.
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
    // Executors normally report outcomes through ctx.report; a returned error is reported here.
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
