//! End-to-end demonstration with mock-server and the downloader engine.
//!
//! Start mock-server in another terminal, then run
//! cargo run -p sjmcl-downloader --example demo.
//!
//! Scenarios run in sequence after each group is submitted:
//! 1. Normal download with SHA-256 verification.
//! 2. Slow transfer, pause, then resume with Range.
//! 3. Two initial HTTP 500 responses followed by a successful backoff retry.
//! 4. Corrupted content triggers verification failure and group draining.
//! 5. Group cancellation.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use sjmcl_downloader::{
  Engine, EngineEvent, SubmitGroup, SubmitTask, TaskState,
  download::DownloadExecutor,
  event::EventSink,
  model::EngineConfig,
  storage::{MemoryStore, SqliteStore},
};
use tokio::time::sleep;
use tracing_subscriber::EnvFilter;

struct PrintSink;

impl EventSink for PrintSink {
  fn emit(&self, ev: &EngineEvent) {
    match ev {
      EngineEvent::Tick(items) => {
        // Print only active progress entries to avoid flooding the terminal.
        let active: Vec<_> = items
          .iter()
          .filter(|p| {
            !matches!(
              p.state,
              TaskState::Done | TaskState::Failed | TaskState::Cancelled
            )
          })
          .collect();
        if active.is_empty() {
          return;
        }
        let line: Vec<String> = active
          .iter()
          .map(|p| {
            let pct = if p.total > 0 {
              format!("{:.1}%", p.received as f64 * 100.0 / p.total as f64)
            } else {
              format!("{}B", p.received)
            };
            let speed = format!("{:.0}KB/s", p.speed_bps / 1024.0);
            let eta = p
              .eta_secs
              .map(|e| format!("eta {:.0}s", e))
              .unwrap_or_default();
            format!("{} [{:?}] {} @{} {}", p.task_id, p.state, pct, speed, eta)
          })
          .collect();
        println!("  [tick] {}", line.join(" | "));
      }
      EngineEvent::GroupSubmitted { group_id } => {
        println!("[group] {group_id}: submitted")
      }
      EngineEvent::TaskStateChanged {
        group_id,
        task_id,
        old,
        new,
      } => {
        println!("  [task] {group_id}/{task_id}: {old:?} -> {new:?}")
      }
      EngineEvent::GroupStateChanged { group_id, old, new } => {
        println!("[group] {group_id}: {old:?} -> {new:?}")
      }
      EngineEvent::GroupFinished {
        group_id,
        finish,
        failed_tasks,
        summary,
      } => {
        println!("[done] {group_id} finished={finish:?} failed={failed_tasks:?} stats={summary:?}")
      }
      EngineEvent::TaskFailed {
        group_id,
        task_id,
        error,
      } => {
        println!("[fail] {group_id}/{task_id}: {error:?}")
      }
      EngineEvent::TaskVerified { group_id, task_id } => {
        println!("[ok]   {group_id}/{task_id} checksum verified")
      }
    }
  }
}

fn task(name: &str, path: &str, dest: &str, sha256: Option<String>) -> SubmitTask {
  SubmitTask {
    name: name.into(),
    executor: "download".into(),
    spec: serde_json::json!({ "url": format!("http://127.0.0.1:8080{path}") }),
    dest: Some(PathBuf::from(dest)),
    sha1: None,
    sha256,
  }
}

async fn wait_finished(engine: &Engine, gid: &str) {
  loop {
    let snap = engine.snapshot().await.unwrap();
    if snap
      .iter()
      .any(|g| g.id == gid && g.state == sjmcl_downloader::model::GroupState::Finished)
    {
      break;
    }
    sleep(Duration::from_millis(100)).await;
  }
}

#[tokio::main]
async fn main() {
  std::fs::create_dir_all("/tmp/opencode/dl").unwrap();
  tracing_subscriber::fmt()
    .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
    .init();

  let cfg = EngineConfig {
    concurrency: 2, // Scenario 4 needs a pending task that fail-fast can cancel before it starts.
    max_active_groups: 2,
    emit_interval: Duration::from_millis(200),
    dispatch_interval: Duration::from_millis(10),
    report_interval: Duration::from_millis(100),
    max_retries: 3,
    retry_backoff: Duration::from_millis(300),
    ..Default::default()
  };
  let store = Arc::new(MemoryStore::default());
  let mut builder = Engine::builder(cfg, Arc::new(PrintSink), store);
  builder.register(Arc::new(DownloadExecutor::default()));
  let (engine, actor) = builder.build();
  let _handle = tokio::spawn(actor);

  println!("== Scenario 1: Normal download ==");
  let g1 = engine
    .submit_group(SubmitGroup {
      parent_group_id: None,
      name: "normal".into(),
      tasks: vec![
        task("a", "/file/2000000", "/tmp/opencode/dl/a.bin", None),
        task("b", "/file/3000000", "/tmp/opencode/dl/b.bin", None),
      ],
      auto_resume: false,
    })
    .await
    .unwrap();
  wait_finished(&engine, &g1).await;
  assert!(
    std::path::Path::new("/tmp/opencode/dl/a.bin").exists(),
    "a.bin should be downloaded"
  );

  println!("== Scenario 2: Pause and resume with Range ==");
  let slow_sha: String = {
    let body = reqwest::get("http://127.0.0.1:8080/sha256/20000000")
      .await
      .unwrap()
      .text()
      .await
      .unwrap();
    serde_json::from_str::<serde_json::Value>(&body).unwrap()["sha256"]
      .as_str()
      .unwrap()
      .into()
  };
  let g2 = engine
    .submit_group(SubmitGroup {
      parent_group_id: None,
      name: "pause-resume".into(),
      tasks: vec![task(
        "slow",
        "/slow/20000000",
        "/tmp/opencode/dl/slow.bin",
        Some(slow_sha),
      )],
      auto_resume: false,
    })
    .await
    .unwrap();
  sleep(Duration::from_millis(1200)).await;
  engine.pause(g2.clone()).await.unwrap();
  println!("  -- Paused; resuming in 2s --");
  sleep(Duration::from_secs(2)).await;
  engine.resume(g2.clone()).await.unwrap();
  wait_finished(&engine, &g2).await;

  println!("== Scenario 3: Retry transient failures ==");
  let g3 = engine
    .submit_group(SubmitGroup {
      parent_group_id: None,
      name: "flaky".into(),
      tasks: vec![task("f", "/flaky/1000000", "/tmp/opencode/dl/f.bin", None)],
      auto_resume: false,
    })
    .await
    .unwrap();
  wait_finished(&engine, &g3).await;

  println!("== Scenario 4: Checksum failure and fail-fast ==");
  // Hash the expected content so the corrupted response must fail verification.
  let good_hash: String = {
    let body = reqwest::get("http://127.0.0.1:8080/sha256/1000000")
      .await
      .unwrap()
      .text()
      .await
      .unwrap();
    serde_json::from_str::<serde_json::Value>(&body).unwrap()["sha256"]
      .as_str()
      .unwrap()
      .into()
  };
  let g4 = engine
    .submit_group(SubmitGroup {
      parent_group_id: None,
      name: "corrupt".into(),
      tasks: vec![
        task("good", "/slow/1000000", "/tmp/opencode/dl/g.bin", None),
        task(
          "bad",
          "/corrupt/1000000",
          "/tmp/opencode/dl/bad.bin",
          Some(good_hash.clone()),
        ),
        task(
          "never",
          "/file/1000000",
          "/tmp/opencode/dl/never.bin",
          Some(good_hash),
        ),
      ],
      auto_resume: false,
    })
    .await
    .unwrap();
  wait_finished(&engine, &g4).await;
  let tasks = engine.list_tasks(g4.clone()).await.unwrap();
  assert!(
    tasks.iter().any(|t| t.state == TaskState::Failed),
    "bad should fail"
  );
  let never = tasks.iter().find(|t| t.name == "never").unwrap();
  assert!(
    matches!(never.state, TaskState::Done | TaskState::Cancelled),
    "never should be cancelled or completed, got {:?}",
    never.state
  );

  println!("== Scenario 5: Cancel group ==");
  let g5 = engine
    .submit_group(SubmitGroup {
      parent_group_id: None,
      name: "cancel".into(),
      tasks: vec![task("x", "/slow/8000000", "/tmp/opencode/dl/x.bin", None)],
      auto_resume: false,
    })
    .await
    .unwrap();
  sleep(Duration::from_millis(1000)).await;
  engine.cancel(g5.clone()).await.unwrap();
  wait_finished(&engine, &g5).await;
  assert!(
    !std::path::Path::new("/tmp/opencode/dl/x.bin.part").exists(),
    ".part should be removed after cancellation"
  );

  println!("== Scenario 6: Limit to 500KB/s (5MB in ~10s) ==");
  let mut ex = DownloadExecutor {
    limiter: Some(std::sync::Arc::new(sjmcl_downloader::TokenBucket::new(
      500 * 1024,
      64 * 1024,
    ))),
    ..Default::default()
  };
  ex.report_interval = Duration::from_millis(50);
  let mut builder2 = Engine::builder(
    EngineConfig {
      concurrency: 2,
      ..Default::default()
    },
    Arc::new(PrintSink),
    Arc::new(MemoryStore::default()),
  );
  builder2.register(Arc::new(ex));
  let (engine2, actor) = builder2.build();
  let _h2 = tokio::spawn(actor);
  let g6 = engine2
    .submit_group(SubmitGroup {
      parent_group_id: None,
      name: "ratelimit".into(),
      tasks: vec![task("rl", "/file/5000000", "/tmp/opencode/dl/rl.bin", None)],
      auto_resume: false,
    })
    .await
    .unwrap();
  let t0 = std::time::Instant::now();
  wait_finished(&engine2, &g6).await;
  let elapsed = t0.elapsed();
  println!("  Download took {:.1}s", elapsed.as_secs_f64());
  assert!(
    elapsed.as_secs_f64() > 7.0,
    "Rate limit not applied: {:.1}s",
    elapsed.as_secs_f64()
  );

  println!("== Scenario 7: Crash recovery (SQLite + .part) ==");
  let db_path = "/tmp/opencode/dl/crash.db";
  let _ = std::fs::remove_file(db_path);
  let _ = std::fs::remove_file(format!("{db_path}-wal"));
  let _ = std::fs::remove_file(format!("{db_path}-shm"));
  let crash_sha: String = {
    let body = reqwest::get("http://127.0.0.1:8080/sha256/20000000")
      .await
      .unwrap()
      .text()
      .await
      .unwrap();
    serde_json::from_str::<serde_json::Value>(&body).unwrap()["sha256"]
      .as_str()
      .unwrap()
      .into()
  };
  // Run the first engine on a dedicated thread and runtime; shutdown_timeout(0)
  // simulates a process crash without interruption reports or cleanup, preserving .part.
  let store1 = Arc::new(SqliteStore::open(std::path::Path::new(db_path)).unwrap());
  let g7 = std::thread::spawn(move || {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let gid = rt.block_on(async {
      let mut b1 = Engine::builder(
        EngineConfig {
          concurrency: 1,
          ..Default::default()
        },
        Arc::new(PrintSink),
        store1,
      );
      b1.register(Arc::new(DownloadExecutor::default()));
      let (engine1, actor) = b1.build();
      let _handle1 = tokio::spawn(actor);
      engine1
        .submit_group(SubmitGroup {
          parent_group_id: None,
          name: "crash".into(),
          tasks: vec![task(
            "cr",
            "/slow/20000000",
            "/tmp/opencode/dl/cr.bin",
            Some(crash_sha),
          )],
          auto_resume: false,
        })
        .await
        .unwrap()
    });
    std::thread::sleep(Duration::from_millis(1200)); // Crash after some bytes have been downloaded.
    rt.shutdown_timeout(Duration::ZERO);
    gid
  })
  .join()
  .unwrap();
  let part_len = std::fs::metadata("/tmp/opencode/dl/cr.bin.part")
    .map(|m| m.len())
    .unwrap_or(0);
  assert!(part_len > 0, ".part should retain progress, got {part_len}");

  // Reopen the same database; the group returns Paused and resume should use Range.
  let store2 = Arc::new(SqliteStore::open(std::path::Path::new(db_path)).unwrap());
  let mut b2 = Engine::builder(
    EngineConfig {
      concurrency: 1,
      ..Default::default()
    },
    Arc::new(PrintSink),
    store2,
  );
  b2.register(Arc::new(DownloadExecutor::default()));
  let (engine2, actor) = b2.build();
  let _h2 = tokio::spawn(actor);
  let snap = engine2.snapshot().await.unwrap();
  let g = snap.iter().find(|g| g.id == g7).unwrap();
  assert_eq!(
    g.state,
    sjmcl_downloader::model::GroupState::Paused,
    "Group should be paused after recovery"
  );
  engine2.resume(g7.clone()).await.unwrap();
  let t1 = std::time::Instant::now();
  wait_finished(&engine2, &g7).await;
  let resume_elapsed = t1.elapsed();
  println!(
    "  Resumed in {:.1}s (full download ~6.3s)",
    resume_elapsed.as_secs_f64()
  );
  assert!(
    resume_elapsed.as_secs_f64() < 5.8,
    "Expected resumption, not a full download: {:.1}s",
    resume_elapsed.as_secs_f64()
  );
  assert!(
    std::path::Path::new("/tmp/opencode/dl/cr.bin").exists(),
    "File should be complete after recovery"
  );

  println!("\nAll scenarios passed.");
  // Wait briefly to observe that Tick events stop.
  sleep(Duration::from_secs(1)).await;
}
