use std::sync::Arc;
use std::time::Duration;

use sjmcl_downloader::executor::BoxFuture;
use sjmcl_downloader::storage::MemoryStore;
use sjmcl_downloader::{
  Engine, EngineConfig, EventSink, FinishKind, GroupState, StateStore, SubmitGroup, SubmitTask,
  Task, TaskError, TaskExecutor, TaskGroup, TaskOutcome, TaskReport, TaskState,
};

struct NoopSink;

impl EventSink for NoopSink {
  fn emit(&self, _event: &sjmcl_downloader::EngineEvent) {}
}

struct CompleteImmediately;

impl TaskExecutor for CompleteImmediately {
  fn name(&self) -> &'static str {
    "test"
  }

  fn run(&self, ctx: sjmcl_downloader::ExecContext) -> BoxFuture<'static, Result<(), TaskError>> {
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

struct WaitForCancellation;

impl TaskExecutor for WaitForCancellation {
  fn name(&self) -> &'static str {
    "test"
  }

  fn run(&self, ctx: sjmcl_downloader::ExecContext) -> BoxFuture<'static, Result<(), TaskError>> {
    Box::pin(async move {
      ctx.run_token.cancelled().await;
      ctx
        .report
        .send(TaskReport::Outcome {
          task_id: ctx.task_id,
          outcome: TaskOutcome::Interrupted { offset: 0 },
        })
        .await
        .unwrap();
      Ok(())
    })
  }
}

struct FailFirstTask;

impl TaskExecutor for FailFirstTask {
  fn name(&self) -> &'static str {
    "test"
  }

  fn run(&self, ctx: sjmcl_downloader::ExecContext) -> BoxFuture<'static, Result<(), TaskError>> {
    Box::pin(async move {
      if ctx.name == "fail" {
        return Err(TaskError::Other("expected failure".into()));
      }
      if ctx.name == "slow" {
        tokio::time::sleep(Duration::from_millis(50)).await;
      }
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

fn submit_task(name: &str) -> SubmitTask {
  SubmitTask {
    name: name.into(),
    executor: "test".into(),
    spec: serde_json::json!({}),
    dest: None,
    sha1: None,
    sha256: None,
  }
}

fn config() -> EngineConfig {
  EngineConfig {
    concurrency: 1,
    max_active_groups: 1,
    dispatch_interval: Duration::from_millis(1),
    emit_interval: Duration::from_millis(10),
    ..EngineConfig::default()
  }
}

fn engine_with(
  store: Arc<MemoryStore>,
  executor: Arc<dyn TaskExecutor>,
) -> (Engine, tokio::task::JoinHandle<()>) {
  let mut builder = Engine::builder(config(), Arc::new(NoopSink), store);
  builder.register(executor);
  builder.spawn()
}

#[tokio::test]
async fn rejects_an_empty_group() {
  let (engine, _handle) = engine_with(
    Arc::new(MemoryStore::default()),
    Arc::new(CompleteImmediately),
  );
  let error = engine
    .submit_group(SubmitGroup {
      name: "empty".into(),
      tasks: vec![],
      auto_resume: false,
    })
    .await
    .unwrap_err();
  assert!(error.to_string().contains("至少需要一个任务"));
}

#[tokio::test]
async fn restored_ids_are_not_reused() {
  let store = Arc::new(MemoryStore::default());
  let mut old_task = Task::new("t42".into(), "g41".into(), &submit_task("old"));
  old_task.state = TaskState::Done;
  store
    .save_group(&TaskGroup {
      id: "g41".into(),
      name: "old".into(),
      auto_resume: false,
      state: GroupState::Finished,
      finish: Some(FinishKind::Completed),
      tasks: vec![old_task],
    })
    .unwrap();

  let (engine, _handle) = engine_with(store, Arc::new(CompleteImmediately));
  let new_group = engine
    .submit_group(SubmitGroup {
      name: "new".into(),
      tasks: vec![submit_task("new")],
      auto_resume: false,
    })
    .await
    .unwrap();
  assert_eq!(new_group, "g43");
  assert_eq!(engine.list_tasks(new_group).await.unwrap()[0].id, "t44");
}

#[tokio::test]
async fn auto_resume_restarts_an_active_group() {
  let store = Arc::new(MemoryStore::default());
  let mut task = Task::new("t2".into(), "g1".into(), &submit_task("resume"));
  task.state = TaskState::Downloading;
  store
    .save_group(&TaskGroup {
      id: "g1".into(),
      name: "auto".into(),
      auto_resume: true,
      state: GroupState::Active,
      finish: None,
      tasks: vec![task],
    })
    .unwrap();

  let (engine, _handle) = engine_with(store, Arc::new(CompleteImmediately));
  let deadline = tokio::time::Instant::now() + Duration::from_secs(1);
  loop {
    let group = engine.snapshot().await.unwrap().remove(0);
    if group.state == GroupState::Finished {
      assert_eq!(group.finish, Some(FinishKind::Completed));
      assert_eq!(group.stats.verified, 0);
      break;
    }
    assert!(tokio::time::Instant::now() < deadline);
    tokio::time::sleep(Duration::from_millis(5)).await;
  }
}

#[tokio::test]
async fn resume_waits_when_the_group_limit_is_full() {
  let (engine, _handle) = engine_with(
    Arc::new(MemoryStore::default()),
    Arc::new(WaitForCancellation),
  );
  let first = engine
    .submit_group(SubmitGroup {
      name: "first".into(),
      tasks: vec![submit_task("first")],
      auto_resume: false,
    })
    .await
    .unwrap();
  engine.pause(first.clone()).await.unwrap();

  let second = engine
    .submit_group(SubmitGroup {
      name: "second".into(),
      tasks: vec![submit_task("second")],
      auto_resume: false,
    })
    .await
    .unwrap();
  engine.resume(first.clone()).await.unwrap();

  let snapshot = engine.snapshot().await.unwrap();
  assert_eq!(
    snapshot.iter().find(|g| g.id == first).unwrap().state,
    GroupState::Queued
  );
  assert_eq!(
    snapshot.iter().find(|g| g.id == second).unwrap().state,
    GroupState::Active
  );
}

#[tokio::test]
async fn tasks_beyond_the_worker_queue_capacity_are_not_lost() {
  let (engine, _handle) = engine_with(
    Arc::new(MemoryStore::default()),
    Arc::new(CompleteImmediately),
  );
  let group_id = engine
    .submit_group(SubmitGroup {
      name: "large".into(),
      tasks: (0..1_050)
        .map(|index| submit_task(&format!("task-{index}")))
        .collect(),
      auto_resume: false,
    })
    .await
    .unwrap();

  let deadline = tokio::time::Instant::now() + Duration::from_secs(10);
  loop {
    let snapshot = engine.snapshot().await.unwrap();
    let group = snapshot.iter().find(|group| group.id == group_id).unwrap();
    if group.state == GroupState::Finished {
      assert_eq!(group.stats.done, 1_050);
      break;
    }
    assert!(tokio::time::Instant::now() < deadline);
    tokio::time::sleep(Duration::from_millis(5)).await;
  }
}

#[tokio::test]
async fn fail_fast_does_not_revive_a_cancelled_task() {
  let mut cfg = config();
  cfg.concurrency = 2;
  let mut builder = Engine::builder(cfg, Arc::new(NoopSink), Arc::new(MemoryStore::default()));
  builder.register(Arc::new(FailFirstTask));
  let (engine, _handle) = builder.spawn();
  let group_id = engine
    .submit_group(SubmitGroup {
      name: "fail-fast".into(),
      tasks: vec![
        submit_task("fail"),
        submit_task("slow"),
        submit_task("never"),
      ],
      auto_resume: false,
    })
    .await
    .unwrap();

  let deadline = tokio::time::Instant::now() + Duration::from_secs(1);
  loop {
    let group = engine
      .snapshot()
      .await
      .unwrap()
      .into_iter()
      .find(|group| group.id == group_id)
      .unwrap();
    if group.state == GroupState::Finished {
      break;
    }
    assert!(tokio::time::Instant::now() < deadline);
    tokio::time::sleep(Duration::from_millis(5)).await;
  }

  let tasks = engine.list_tasks(group_id).await.unwrap();
  assert_eq!(
    tasks
      .iter()
      .find(|task| task.name == "never")
      .unwrap()
      .state,
    TaskState::Cancelled
  );
}

#[tokio::test]
async fn removes_only_finished_groups() {
  let (engine, _handle) = engine_with(
    Arc::new(MemoryStore::default()),
    Arc::new(WaitForCancellation),
  );
  let group_id = engine
    .submit_group(SubmitGroup {
      name: "remove-finished".into(),
      tasks: vec![submit_task("one")],
      auto_resume: false,
    })
    .await
    .unwrap();

  assert!(engine.remove(group_id.clone()).await.is_err());
  engine.cancel(group_id.clone()).await.unwrap();
  let deadline = tokio::time::Instant::now() + Duration::from_secs(1);
  loop {
    let group = engine
      .snapshot()
      .await
      .unwrap()
      .into_iter()
      .find(|group| group.id == group_id)
      .unwrap();
    if group.state == GroupState::Finished {
      break;
    }
    assert!(tokio::time::Instant::now() < deadline);
    tokio::time::sleep(Duration::from_millis(5)).await;
  }

  engine.remove(group_id.clone()).await.unwrap();
  assert!(
    engine
      .snapshot()
      .await
      .unwrap()
      .iter()
      .all(|group| group.id != group_id)
  );
}
