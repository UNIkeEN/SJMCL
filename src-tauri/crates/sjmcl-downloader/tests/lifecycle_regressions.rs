use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use sjmcl_downloader::event::NoopSink;
use sjmcl_downloader::executor::BoxFuture;
use sjmcl_downloader::storage::{MemoryStore, SqliteStore};
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
  let (engine, actor) = builder.build();
  (engine, tokio::spawn(actor))
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
  assert!(!group.completion_pending);
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
      completion_pending: false,
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

#[tokio::test]
async fn restart_hides_cancelled_groups_but_keeps_failed_groups_retryable() {
  for finish in [FinishKind::Cancelled, FinishKind::Failed] {
    let store = Arc::new(MemoryStore::default());
    let mut task = Task::new("t2".into(), "g1".into(), &submit_task(None));
    task.state = if finish == FinishKind::Cancelled {
      TaskState::Cancelled
    } else {
      TaskState::Failed
    };
    store
      .save_group(&TaskGroup {
        id: "g1".into(),
        name: "download".into(),
        auto_resume: true,
        state: GroupState::Finished,
        finish: Some(finish),
        completion_pending: false,
        tasks: vec![task],
      })
      .unwrap();
    let (engine, actor) = start(store, Arc::new(CompleteImmediately));
    let groups = engine.snapshot().await.unwrap();
    if finish == FinishKind::Cancelled {
      assert!(groups.is_empty());
    } else {
      assert_eq!(groups.len(), 1);
      assert_eq!(groups[0].finish, Some(FinishKind::Failed));
      engine.retry("g1".into()).await.unwrap();
      wait_for_task(&engine, "g1", TaskState::Done).await;
    }
    actor.abort();
    actor.await.unwrap_err();
  }
}

#[tokio::test]
async fn persisted_errors_survive_restart_and_remain_retryable() {
  let dir = TempDir::new();
  let path = dir.0.join("downloads.db");
  for error in [
    TaskError::Http { status: 403 },
    TaskError::Application {
      code: "OPTIFINE_MISSING".into(),
    },
    sjmcl_downloader::EngineError::EngineNotInitialized.into(),
  ] {
    let store = SqliteStore::open(&path).unwrap();
    let mut task = Task::new("t2".into(), "g1".into(), &submit_task(None));
    task.state = TaskState::Failed;
    task.error = Some(error.clone());
    task.retries_exhausted = true;
    store
      .save_group(&TaskGroup {
        id: "g1".into(),
        name: "download".into(),
        auto_resume: true,
        state: GroupState::Finished,
        finish: Some(FinishKind::Failed),
        completion_pending: false,
        tasks: vec![task],
      })
      .unwrap();
    drop(store);

    let (engine, actor) = start(
      Arc::new(SqliteStore::open(&path).unwrap()),
      Arc::new(CompleteImmediately),
    );
    assert_eq!(
      engine.list_tasks("g1".into()).await.unwrap()[0].error,
      Some(error)
    );
    engine.retry("g1".into()).await.unwrap();
    wait_for_task(&engine, "g1", TaskState::Done).await;
    assert!(
      engine.list_tasks("g1".into()).await.unwrap()[0]
        .error
        .is_none()
    );
    actor.abort();
    actor.await.unwrap_err();
  }
}

#[tokio::test]
async fn recovered_completion_is_retained_until_acknowledged_then_hidden_after_restart() {
  let dir = TempDir::new();
  let path = dir.0.join("downloads.db");
  let store = Arc::new(SqliteStore::open(&path).unwrap());
  store
    .save_group(&TaskGroup {
      id: "g1".into(),
      name: "modpack?pack".into(),
      auto_resume: true,
      state: GroupState::Active,
      finish: None,
      completion_pending: false,
      tasks: vec![Task::new("t2".into(), "g1".into(), &submit_task(None))],
    })
    .unwrap();
  // The group recovers and finishes with no frontend listener attached.
  let (engine, actor) = start(store, Arc::new(CompleteImmediately));
  wait_for_task(&engine, "g1", TaskState::Done).await;
  assert!(engine.snapshot().await.unwrap()[0].completion_pending);
  actor.abort();
  actor.await.unwrap_err();

  let (engine, actor) = start(
    Arc::new(SqliteStore::open(&path).unwrap()),
    Arc::new(CompleteImmediately),
  );
  assert!(engine.snapshot().await.unwrap()[0].completion_pending);
  engine.acknowledge_completion("g1".into()).await.unwrap();
  engine.acknowledge_completion("g1".into()).await.unwrap();
  assert!(!engine.snapshot().await.unwrap()[0].completion_pending);
  actor.abort();
  actor.await.unwrap_err();

  let (engine, actor) = start(
    Arc::new(SqliteStore::open(&path).unwrap()),
    Arc::new(CompleteImmediately),
  );
  assert!(engine.snapshot().await.unwrap().is_empty());
  actor.abort();
}
