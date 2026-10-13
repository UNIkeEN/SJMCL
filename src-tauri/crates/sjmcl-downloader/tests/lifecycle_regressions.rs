use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use sjmcl_downloader::event::NoopSink;
use sjmcl_downloader::executor::BoxFuture;
use sjmcl_downloader::storage::MemoryStore;
use sjmcl_downloader::{
  Engine, EngineConfig, ExecContext, FinishKind, GroupState, StateStore, SubmitGroup, SubmitTask,
  Task, TaskError, TaskExecutor, TaskGroup, TaskOutcome, TaskReport, TaskState,
};
use tokio::sync::Notify;

struct TempDir(PathBuf);

impl TempDir {
  fn new() -> Self {
    static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    let sequence = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let path =
      std::env::temp_dir().join(format!("sjmcl-lifecycle-{}-{sequence}", std::process::id()));
    std::fs::create_dir_all(&path).unwrap();
    Self(path)
  }
}

impl Drop for TempDir {
  fn drop(&mut self) {
    let _ = std::fs::remove_dir_all(&self.0);
  }
}

struct ControlledDownload {
  started: Arc<Notify>,
  exited: Arc<Notify>,
  finish: Option<Arc<Notify>>,
}

impl TaskExecutor for ControlledDownload {
  fn name(&self) -> &'static str {
    "test"
  }

  fn run(&self, ctx: ExecContext) -> BoxFuture<'static, Result<(), TaskError>> {
    let started = self.started.clone();
    let exited = self.exited.clone();
    let finish = self.finish.clone();
    Box::pin(async move {
      if let Some(dest) = &ctx.dest {
        let mut path = dest.as_os_str().to_owned();
        path.push(".part");
        std::fs::write(PathBuf::from(path), b"partial").unwrap();
      }
      started.notify_one();
      let outcome = if let Some(finish) = finish {
        finish.notified().await;
        TaskOutcome::Done { verified: false }
      } else {
        ctx.run_token.cancelled().await;
        TaskOutcome::Interrupted { offset: 7 }
      };
      ctx
        .report
        .send(TaskReport::Outcome {
          task_id: ctx.task_id,
          outcome,
        })
        .await
        .unwrap();
      exited.notify_one();
      Ok(())
    })
  }
}

struct CompleteImmediately;

impl TaskExecutor for CompleteImmediately {
  fn name(&self) -> &'static str {
    "test"
  }

  fn run(&self, ctx: ExecContext) -> BoxFuture<'static, Result<(), TaskError>> {
    Box::pin(async move {
      ctx
        .report
        .send(TaskReport::Outcome {
          task_id: ctx.task_id,
          outcome: TaskOutcome::Done { verified: false },
        })
        .await
        .unwrap();
      Ok(())
    })
  }
}

fn submit_task(dest: Option<PathBuf>) -> SubmitTask {
  SubmitTask {
    name: "file".into(),
    executor: "test".into(),
    spec: serde_json::json!({}),
    dest,
    sha1: None,
    sha256: None,
  }
}

fn start(
  store: Arc<dyn StateStore>,
  executor: Arc<dyn TaskExecutor>,
) -> (Engine, tokio::task::JoinHandle<()>) {
  let mut builder = Engine::builder(
    EngineConfig {
      concurrency: 1,
      dispatch_interval: Duration::from_millis(1),
      ..EngineConfig::default()
    },
    Arc::new(NoopSink),
    store,
  );
  builder.register(executor);
  builder.spawn()
}

async fn wait_for_task(engine: &Engine, group_id: &str, expected: TaskState) {
  tokio::time::timeout(Duration::from_secs(2), async {
    while engine.list_tasks(group_id.into()).await.unwrap()[0].state != expected {
      tokio::time::sleep(Duration::from_millis(1)).await;
    }
  })
  .await
  .unwrap();
}

#[tokio::test]
async fn cancel_after_paused_worker_exits_finishes_and_removes_partial_file() {
  let dir = TempDir::new();
  let started = Arc::new(Notify::new());
  let exited = Arc::new(Notify::new());
  let (engine, actor) = start(
    Arc::new(MemoryStore::default()),
    Arc::new(ControlledDownload {
      started: started.clone(),
      exited: exited.clone(),
      finish: None,
    }),
  );
  let id = engine
    .submit_group(SubmitGroup {
      name: "paused".into(),
      tasks: vec![submit_task(Some(dir.0.join("file")))],
      auto_resume: true,
    })
    .await
    .unwrap();
  started.notified().await;
  engine.pause(id.clone()).await.unwrap();
  exited.notified().await;
  wait_for_task(&engine, &id, TaskState::Paused).await;
  assert!(dir.0.join("file.part").exists());

  engine.cancel(id.clone()).await.unwrap();
  let group = engine.snapshot().await.unwrap().remove(0);
  assert_eq!(group.state, GroupState::Finished);
  assert_eq!(group.finish, Some(FinishKind::Cancelled));
  let task = engine.list_tasks(id).await.unwrap().remove(0);
  assert_eq!(task.state, TaskState::Cancelled);
  assert_eq!((task.offset, task.received), (0, 0));
  assert!(!dir.0.join("file.part").exists());
  actor.abort();
}

#[tokio::test]
async fn cancelling_restored_paused_and_pending_tasks_cleans_only_partial_files() {
  let dir = TempDir::new();
  let store = Arc::new(MemoryStore::default());
  let tasks = [TaskState::Paused, TaskState::Pending]
    .into_iter()
    .enumerate()
    .map(|(index, state)| {
      let dest = dir.0.join(format!("file{index}"));
      std::fs::write(&dest, b"final").unwrap();
      std::fs::write(dir.0.join(format!("file{index}.part")), b"partial").unwrap();
      let mut task = Task::new(
        format!("t{}", index + 2),
        "g1".into(),
        &submit_task(Some(dest)),
      );
      task.state = state;
      task.offset = 7;
      task
    })
    .collect();
  store
    .save_group(&TaskGroup {
      id: "g1".into(),
      name: "paused".into(),
      auto_resume: true,
      state: GroupState::Paused,
      finish: None,
      tasks,
    })
    .unwrap();
  let (engine, actor) = start(store, Arc::new(CompleteImmediately));
  engine.cancel("g1".into()).await.unwrap();
  assert_eq!(
    engine.snapshot().await.unwrap()[0].finish,
    Some(FinishKind::Cancelled)
  );
  for index in 0..2 {
    assert!(!dir.0.join(format!("file{index}.part")).exists());
    assert_eq!(
      std::fs::read(dir.0.join(format!("file{index}"))).unwrap(),
      b"final"
    );
  }
  actor.abort();
}

#[tokio::test]
async fn cancelling_a_running_worker_preserves_its_actual_success_report() {
  let started = Arc::new(Notify::new());
  let finish = Arc::new(Notify::new());
  let (engine, actor) = start(
    Arc::new(MemoryStore::default()),
    Arc::new(ControlledDownload {
      started: started.clone(),
      exited: Arc::new(Notify::new()),
      finish: Some(finish.clone()),
    }),
  );
  let id = engine
    .submit_group(SubmitGroup {
      name: "running".into(),
      tasks: vec![submit_task(None)],
      auto_resume: false,
    })
    .await
    .unwrap();
  started.notified().await;
  engine.cancel(id.clone()).await.unwrap();
  assert_eq!(
    engine.snapshot().await.unwrap()[0].state,
    GroupState::Draining
  );
  assert_eq!(
    engine.list_tasks(id.clone()).await.unwrap()[0].state,
    TaskState::Downloading
  );
  finish.notify_one();
  wait_for_task(&engine, &id, TaskState::Done).await;
  assert_eq!(
    engine.snapshot().await.unwrap()[0].finish,
    Some(FinishKind::Cancelled)
  );
  actor.abort();
}
