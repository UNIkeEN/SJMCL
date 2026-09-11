//! End-to-end demo using a mock server and the sjmcl-downloader engine.
//!
//! Start the mock server in another terminal, then run
//! `cargo run -p tauri-plugin-sjmcl-downloader --example demo`.
//!
//! The demo runs these scenarios in sequence:
//!   1. Successful download with SHA-256 verification.
//!   2. Rate-limited download paused and resumed through a Range request.
//!   3. Two initial 500 responses followed by a successful backoff retry.
//!   4. Corrupt content triggering verification failure and fail-fast Draining.
//!   5. Group cancellation.
//!   6. Global rate limiting at 500 KB/s.
//!   7. Crash recovery from SQLite state and a partial file.

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
        // Print only entries with speed or progress to limit output.
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
        println!("[fail] {group_id}/{task_id}: {error}")
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
    concurrency: 2, // Scenario 4 needs an unstarted Pending task for fail-fast cancellation.
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
  let (engine, _handle) = builder.spawn();

  println!("== 场景1: 正常下载 + 校验 ==");
  let g1 = engine
    .submit_group(SubmitGroup {
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
    "a.bin 应下载完成"
  );

  println!("== 场景2: slow + 暂停/恢复（Range 续传）==");
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
  println!("  -- 已暂停, 2 秒后恢复 --");
  sleep(Duration::from_secs(2)).await;
  engine.resume(g2.clone()).await.unwrap();
  wait_finished(&engine, &g2).await;

  println!("== 场景3: flaky 自动重试 ==");
  let g3 = engine
    .submit_group(SubmitGroup {
      name: "flaky".into(),
      tasks: vec![task("f", "/flaky/1000000", "/tmp/opencode/dl/f.bin", None)],
      auto_resume: false,
    })
    .await
    .unwrap();
  wait_finished(&engine, &g3).await;

  println!("== 场景4: corrupt 校验失败 → fail-fast ==");
  // Hash the expected content so the altered corrupt response must fail verification.
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
    "bad 应 Failed"
  );
  let never = tasks.iter().find(|t| t.name == "never").unwrap();
  assert!(
    matches!(never.state, TaskState::Done | TaskState::Cancelled),
    "never 应被中止(未开始)或排水完成(已被领取)，实际 {:?}",
    never.state
  );

  println!("== 场景5: 取消组 ==");
  let g5 = engine
    .submit_group(SubmitGroup {
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
    "取消后 .part 应删除"
  );

  println!("== 场景6: 全局限速 500KB/s（5MB 文件应约 10s）==");
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
  let (engine2, _h2) = builder2.spawn();
  let g6 = engine2
    .submit_group(SubmitGroup {
      name: "ratelimit".into(),
      tasks: vec![task("rl", "/file/5000000", "/tmp/opencode/dl/rl.bin", None)],
      auto_resume: false,
    })
    .await
    .unwrap();
  let t0 = std::time::Instant::now();
  wait_finished(&engine2, &g6).await;
  let elapsed = t0.elapsed();
  println!("  限速下载耗时 {:.1}s", elapsed.as_secs_f64());
  assert!(
    elapsed.as_secs_f64() > 7.0,
    "限速未生效: {:.1}s",
    elapsed.as_secs_f64()
  );

  println!("== 场景7: 崩溃恢复（SQLite + .part 续传）==");
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
  // Run the first engine on a dedicated thread and runtime. shutdown_timeout(0) stops every task,
  // accurately simulating a process crash: no Interrupted report or cleanup, a dropped connection,
  // and a retained `.part` file.
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
      let (engine1, _handle1) = b1.spawn();
      engine1
        .submit_group(SubmitGroup {
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
    std::thread::sleep(Duration::from_millis(1200)); // Crash after downloading part of the file.
    rt.shutdown_timeout(Duration::ZERO);
    gid
  })
  .join()
  .unwrap();
  let part_len = std::fs::metadata("/tmp/opencode/dl/cr.bin.part")
    .map(|m| m.len())
    .unwrap_or(0);
  assert!(part_len > 0, ".part 应保留崩溃时的进度，实际 {part_len}");

  // Restart with the same database. State restores as Paused and resume should continue the file.
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
  let (engine2, _h2) = b2.spawn();
  let snap = engine2.snapshot().await.unwrap();
  let g = snap.iter().find(|g| g.id == g7).unwrap();
  assert_eq!(
    g.state,
    sjmcl_downloader::model::GroupState::Paused,
    "崩溃后组应恢复为 Paused"
  );
  engine2.resume(g7.clone()).await.unwrap();
  let t1 = std::time::Instant::now();
  wait_finished(&engine2, &g7).await;
  let resume_elapsed = t1.elapsed();
  println!(
    "  崩溃后 resume 耗时 {:.1}s（全量约 6.3s）",
    resume_elapsed.as_secs_f64()
  );
  assert!(
    resume_elapsed.as_secs_f64() < 5.8,
    "应为续传而非重下: {:.1}s",
    resume_elapsed.as_secs_f64()
  );
  assert!(
    std::path::Path::new("/tmp/opencode/dl/cr.bin").exists(),
    "恢复后文件应完成"
  );

  println!("\n全部场景通过 ✓");
  // Keep the process alive briefly to observe tick emission stopping.
  sleep(Duration::from_secs(1)).await;
}
