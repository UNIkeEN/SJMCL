use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use sha1::{Digest, Sha1};
use sjmcl_downloader::download::DownloadExecutor;
use sjmcl_downloader::event::NoopSink;
use sjmcl_downloader::storage::MemoryStore;
use sjmcl_downloader::{
  Engine, EngineConfig, EngineEvent, EventSink, FinishKind, GroupState, SubmitGroup, SubmitTask,
  TaskError, TaskState,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

struct TempDownload {
  path: PathBuf,
}

impl TempDownload {
  fn new(name: &str) -> Self {
    static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    let sequence = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    Self {
      path: std::env::temp_dir().join(format!(
        "sjmcl-downloader-{name}-{}-{sequence}.bin",
        std::process::id()
      )),
    }
  }

  fn part_path(&self) -> PathBuf {
    PathBuf::from(format!("{}.part", self.path.display()))
  }
}

impl Drop for TempDownload {
  fn drop(&mut self) {
    let _ = std::fs::remove_file(&self.path);
    let _ = std::fs::remove_file(self.part_path());
  }
}

async fn read_request(socket: &mut tokio::net::TcpStream) -> String {
  let mut request = Vec::new();
  let mut chunk = [0_u8; 1024];
  while !request.windows(4).any(|window| window == b"\r\n\r\n") {
    let read = socket.read(&mut chunk).await.unwrap();
    assert!(read > 0, "client closed before sending request headers");
    request.extend_from_slice(&chunk[..read]);
  }
  String::from_utf8(request).unwrap().to_ascii_lowercase()
}

async fn serve_once(
  body: Vec<u8>,
  range_start: Option<usize>,
  required_header: Option<(&'static str, &'static str)>,
  chunked: bool,
) -> (String, tokio::task::JoinHandle<()>) {
  let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
  let address = listener.local_addr().unwrap();
  let handle = tokio::spawn(async move {
    let (mut socket, _) = listener.accept().await.unwrap();
    let request = read_request(&mut socket).await;
    if let Some(start) = range_start {
      assert!(request.contains(&format!("range: bytes={start}-")));
    }
    if let Some((name, value)) = required_header {
      assert!(request.contains(&format!(
        "{}: {}",
        name.to_ascii_lowercase(),
        value.to_ascii_lowercase()
      )));
    }

    let (status, headers, response_body) = if let Some(start) = range_start {
      (
        "206 Partial Content",
        format!(
          "Content-Range: bytes {start}-{}/{}\r\n",
          body.len() - 1,
          body.len()
        ),
        &body[start..],
      )
    } else {
      ("200 OK", String::new(), body.as_slice())
    };
    let framing = if chunked {
      "Transfer-Encoding: chunked\r\n".to_string()
    } else {
      format!("Content-Length: {}\r\n", response_body.len())
    };
    let response = format!("HTTP/1.1 {status}\r\n{framing}{headers}Connection: close\r\n\r\n");
    socket.write_all(response.as_bytes()).await.unwrap();
    if chunked {
      socket
        .write_all(format!("{:x}\r\n", response_body.len()).as_bytes())
        .await
        .unwrap();
    }
    socket.write_all(response_body).await.unwrap();
    if chunked {
      socket.write_all(b"\r\n0\r\n\r\n").await.unwrap();
    }
    socket.shutdown().await.unwrap();
  });
  (format!("http://{address}/file"), handle)
}

struct TestResponse {
  expected_range: Option<usize>,
  status: &'static str,
  headers: String,
  body: Vec<u8>,
}

async fn serve_responses(responses: Vec<TestResponse>) -> (String, tokio::task::JoinHandle<()>) {
  let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
  let address = listener.local_addr().unwrap();
  let handle = tokio::spawn(async move {
    for response in responses {
      let (mut socket, _) = listener.accept().await.unwrap();
      let request = read_request(&mut socket).await;
      if let Some(start) = response.expected_range {
        assert!(request.contains(&format!("\r\nrange: bytes={start}-\r\n")));
      } else {
        assert!(!request.contains("\r\nrange:"));
      }
      assert!(request.contains("\r\naccept-encoding: identity\r\n"));
      assert!(request.contains("\r\nx-api-key: test-key\r\n"));
      let headers = format!(
        "HTTP/1.1 {}\r\nContent-Length: {}\r\n{}Connection: close\r\n\r\n",
        response.status,
        response.body.len(),
        response.headers
      );
      socket.write_all(headers.as_bytes()).await.unwrap();
      socket.write_all(&response.body).await.unwrap();
      socket.shutdown().await.unwrap();
    }
  });
  (format!("http://{address}/file"), handle)
}

fn decorated_executor() -> DownloadExecutor {
  DownloadExecutor {
    request_decorator: Some(Arc::new(|_, request| {
      request.header("x-api-key", "test-key")
    })),
    ..DownloadExecutor::default()
  }
}

fn engine(executor: DownloadExecutor) -> Engine {
  engine_with_sink(executor, Arc::new(NoopSink), Duration::from_millis(5))
}

fn engine_with_sink(
  executor: DownloadExecutor,
  sink: Arc<dyn EventSink>,
  emit_interval: Duration,
) -> Engine {
  let config = EngineConfig {
    concurrency: 1,
    max_active_groups: 1,
    dispatch_interval: Duration::from_millis(1),
    emit_interval,
    report_interval: Duration::from_millis(1),
    max_retries: 0,
    ..EngineConfig::default()
  };
  let mut builder = Engine::builder(config, sink, Arc::new(MemoryStore::default()));
  builder.register(Arc::new(executor));
  let (engine, actor) = builder.build();
  tokio::spawn(actor);
  engine
}

fn task(url: String, destination: &Path, sha1: Option<String>) -> SubmitTask {
  SubmitTask {
    name: destination
      .file_name()
      .unwrap()
      .to_string_lossy()
      .into_owned(),
    executor: "download".into(),
    spec: serde_json::json!({ "url": url }),
    dest: Some(destination.to_path_buf()),
    sha1,
    sha256: None,
  }
}

async fn wait_finished(engine: &Engine, group_id: &str) -> FinishKind {
  let deadline = tokio::time::Instant::now() + Duration::from_secs(3);
  loop {
    let group = engine
      .snapshot()
      .await
      .unwrap()
      .into_iter()
      .find(|group| group.id == group_id)
      .unwrap();
    if group.state == GroupState::Finished {
      return group.finish.unwrap();
    }
    assert!(tokio::time::Instant::now() < deadline);
    tokio::time::sleep(Duration::from_millis(5)).await;
  }
}

#[tokio::test]
async fn downloads_with_sha1_and_url_scoped_request_decoration() {
  let body = b"reliable minecraft payload".to_vec();
  let expected = format!("{:x}", Sha1::digest(&body));
  let (url, server) = serve_once(body.clone(), None, Some(("x-api-key", "test-key")), false).await;
  let destination = TempDownload::new("sha1");
  tokio::fs::write(&destination.path, b"old content")
    .await
    .unwrap();

  let executor = DownloadExecutor {
    request_decorator: Some(Arc::new(|_, request| {
      request.header("x-api-key", "test-key")
    })),
    ..DownloadExecutor::default()
  };
  let engine = engine(executor);
  let group_id = engine
    .submit_group(SubmitGroup {
      name: "sha1".into(),
      tasks: vec![task(url, &destination.path, Some(expected))],
      auto_resume: true,
    })
    .await
    .unwrap();

  assert_eq!(
    wait_finished(&engine, &group_id).await,
    FinishKind::Completed
  );
  assert_eq!(tokio::fs::read(&destination.path).await.unwrap(), body);
  assert!(!destination.part_path().exists());
  let tasks = engine.list_tasks(group_id).await.unwrap();
  assert_eq!(tasks[0].state, TaskState::Done);
  assert!(tasks[0].verified);
  server.await.unwrap();
}

#[tokio::test]
async fn response_size_overrides_the_manifest_hint() {
  let body = b"actual file contents".to_vec();
  let (url, server) = serve_once(body.clone(), None, None, false).await;
  let destination = TempDownload::new("size-hint");
  let engine = engine(DownloadExecutor::default());
  let mut download = task(url, &destination.path, None);
  download.spec["size"] = serde_json::json!(1);
  let group_id = engine
    .submit_group(SubmitGroup {
      name: "size-hint".into(),
      tasks: vec![download],
      auto_resume: true,
    })
    .await
    .unwrap();

  assert_eq!(
    wait_finished(&engine, &group_id).await,
    FinishKind::Completed
  );
  let tasks = engine.list_tasks(group_id).await.unwrap();
  assert_eq!(tasks[0].total, body.len() as u64);
  assert_eq!(tasks[0].received, body.len() as u64);
  assert_eq!(tokio::fs::read(&destination.path).await.unwrap(), body);
  server.await.unwrap();
}

#[derive(Default)]
struct RecordingSink(Mutex<Vec<EngineEvent>>);

impl EventSink for RecordingSink {
  fn emit(&self, event: &EngineEvent) {
    self.0.lock().unwrap().push(event.clone());
  }
}

#[tokio::test]
async fn chunked_downloads_report_actual_size_and_final_progress_without_periodic_ticks() {
  let body = b"payload without content-length".to_vec();
  for size in [None, Some(body.len() as u64), Some(1), Some(1_000_000)] {
    let (url, server) = serve_once(body.clone(), None, None, true).await;
    let destination = TempDownload::new("chunked");
    let sink = Arc::new(RecordingSink::default());
    let engine = engine_with_sink(
      DownloadExecutor::default(),
      sink.clone(),
      Duration::from_secs(3600),
    );
    let mut download = task(url, &destination.path, None);
    download.spec["size"] = serde_json::json!(size);
    let group_id = engine
      .submit_group(SubmitGroup {
        name: "chunked".into(),
        tasks: vec![download],
        auto_resume: true,
      })
      .await
      .unwrap();

    assert_eq!(
      wait_finished(&engine, &group_id).await,
      FinishKind::Completed
    );
    let tasks = engine.list_tasks(group_id.clone()).await.unwrap();
    assert_eq!(tasks[0].received, body.len() as u64);
    assert_eq!(tasks[0].total, body.len() as u64);
    assert_eq!(tokio::fs::read(&destination.path).await.unwrap(), body);
    assert!(sink.0.lock().unwrap().iter().any(|event| {
      matches!(event, EngineEvent::Tick(updates) if updates.iter().any(|progress| {
        progress.group_id == group_id
          && progress.task_id == tasks[0].id
          && progress.state == TaskState::Done
          && progress.received == body.len() as u64
          && progress.total == body.len() as u64
          && progress.speed_bps == 0.0
          && progress.eta_secs.is_none()
      }))
    }));
    server.await.unwrap();
  }
}

#[tokio::test]
async fn resumes_from_the_authoritative_part_file() {
  let body = b"0123456789abcdefghij".to_vec();
  let expected = format!("{:x}", Sha1::digest(&body));
  let (url, server) = serve_once(body.clone(), Some(7), None, false).await;
  let destination = TempDownload::new("resume");
  tokio::fs::write(destination.part_path(), &body[..7])
    .await
    .unwrap();

  let engine = engine(DownloadExecutor::default());
  let group_id = engine
    .submit_group(SubmitGroup {
      name: "resume".into(),
      tasks: vec![task(url, &destination.path, Some(expected))],
      auto_resume: true,
    })
    .await
    .unwrap();

  assert_eq!(
    wait_finished(&engine, &group_id).await,
    FinishKind::Completed
  );
  assert_eq!(tokio::fs::read(&destination.path).await.unwrap(), body);
  server.await.unwrap();
}

#[tokio::test]
async fn rejected_or_invalid_ranges_fall_back_without_using_the_retry_budget() {
  let body = b"0123456789abcdefghij".to_vec();
  let expected = format!("{:x}", Sha1::digest(&body));
  for (status, headers) in [
    ("400 Bad Request", ""),
    ("401 Unauthorized", ""),
    ("403 Forbidden", ""),
    ("404 Not Found", ""),
    ("405 Method Not Allowed", ""),
    ("406 Not Acceptable", ""),
    ("408 Request Timeout", ""),
    ("416 Range Not Satisfiable", ""),
    ("416 Range Not Satisfiable", "Content-Range: bytes */3\r\n"),
    ("422 Unprocessable Entity", ""),
    ("429 Too Many Requests", ""),
    ("500 Internal Server Error", ""),
    ("501 Not Implemented", ""),
    ("502 Bad Gateway", ""),
    ("503 Service Unavailable", ""),
    ("206 Partial Content", ""),
    ("206 Partial Content", "Content-Range: invalid\r\n"),
    ("206 Partial Content", "Content-Range: bytes 8-19/20\r\n"),
  ] {
    let destination = TempDownload::new("range-fallback");
    tokio::fs::write(destination.part_path(), &body[..7])
      .await
      .unwrap();
    let (url, server) = serve_responses(vec![
      TestResponse {
        expected_range: Some(7),
        status,
        headers: headers.into(),
        body: b"unsupported range".to_vec(),
      },
      TestResponse {
        expected_range: None,
        status: "200 OK",
        headers: String::new(),
        body: body.clone(),
      },
    ])
    .await;
    let engine = engine(decorated_executor());
    let group_id = engine
      .submit_group(SubmitGroup {
        name: "range-fallback".into(),
        tasks: vec![task(url, &destination.path, Some(expected.clone()))],
        auto_resume: true,
      })
      .await
      .unwrap();

    assert_eq!(
      wait_finished(&engine, &group_id).await,
      FinishKind::Completed,
      "range response: {status}, {headers}"
    );
    assert_eq!(tokio::fs::read(&destination.path).await.unwrap(), body);
    assert!(!destination.part_path().exists());
    let tasks = engine.list_tasks(group_id).await.unwrap();
    assert_eq!(tasks[0].attempts, 0);
    assert!(tasks[0].verified);
    assert_eq!(tasks[0].received, body.len() as u64);
    assert_eq!(tasks[0].total, body.len() as u64);
    server.await.unwrap();
  }
}

#[tokio::test]
async fn interrupted_range_requests_get_only_one_full_download_fallback() {
  let body = b"0123456789abcdefghij".to_vec();
  for (before_headers, full_succeeds) in
    [(true, true), (false, true), (true, false), (false, false)]
  {
    let destination = TempDownload::new("range-network-fallback");
    tokio::fs::write(destination.part_path(), &body[..7])
      .await
      .unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let response_body = body.clone();
    let server = tokio::spawn(async move {
      for range_start in [Some(7), None] {
        let (mut socket, _) = listener.accept().await.unwrap();
        let request = read_request(&mut socket).await;
        assert!(request.contains("\r\naccept-encoding: identity\r\n"));
        assert!(request.contains("\r\nx-api-key: test-key\r\n"));
        if let Some(start) = range_start {
          assert!(request.contains(&format!("\r\nrange: bytes={start}-\r\n")));
          if !before_headers {
            let headers = format!(
              "HTTP/1.1 206 Partial Content\r\nContent-Length: {}\r\nContent-Range: bytes {start}-{}/{}\r\nConnection: close\r\n\r\n",
              response_body.len() - start,
              response_body.len() - 1,
              response_body.len()
            );
            socket.write_all(headers.as_bytes()).await.unwrap();
            // Close before the promised body is complete.
            socket.write_all(&response_body[start..10]).await.unwrap();
          }
        } else {
          assert!(!request.contains("\r\nrange:"));
          if full_succeeds || !before_headers {
            let headers = format!(
              "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
              response_body.len()
            );
            socket.write_all(headers.as_bytes()).await.unwrap();
            let full_body = if full_succeeds {
              response_body.as_slice()
            } else {
              &response_body[..3]
            };
            socket.write_all(full_body).await.unwrap();
          }
        }
        socket.shutdown().await.unwrap();
      }
    });
    let engine = engine(decorated_executor());
    let group_id = engine
      .submit_group(SubmitGroup {
        name: "range-network-fallback".into(),
        tasks: vec![task(
          format!("http://{address}/file"),
          &destination.path,
          Some(format!("{:x}", Sha1::digest(&body))),
        )],
        auto_resume: true,
      })
      .await
      .unwrap();

    assert_eq!(
      wait_finished(&engine, &group_id).await,
      if full_succeeds {
        FinishKind::Completed
      } else {
        FinishKind::Failed
      },
      "connection interrupted before response headers: {before_headers}, full GET succeeds: {full_succeeds}"
    );
    let tasks = engine.list_tasks(group_id).await.unwrap();
    assert_eq!(tasks[0].attempts, 0);
    if full_succeeds {
      assert_eq!(tokio::fs::read(&destination.path).await.unwrap(), body);
      assert!(!destination.part_path().exists());
      assert!(tasks[0].verified);
      assert_eq!(tasks[0].received, body.len() as u64);
      assert_eq!(tasks[0].total, body.len() as u64);
    } else {
      assert!(matches!(tasks[0].error, Some(TaskError::Network { .. })));
      assert!(!destination.path.exists());
      let partial = tokio::fs::read(destination.part_path()).await.unwrap();
      if before_headers {
        // Neither request returned a usable response; retain the original partial file.
        assert_eq!(partial, &body[..7]);
      } else {
        // The full response replaces the old partial file, even if it later breaks.
        assert!(partial.len() <= 3);
        assert!(body.starts_with(&partial));
      }
    }
    server.await.unwrap();
  }
}

#[tokio::test]
async fn ignored_ranges_replace_the_partial_file_without_appending() {
  let body = b"0123456789abcdefghij".to_vec();
  let destination = TempDownload::new("range-ignored");
  tokio::fs::write(destination.part_path(), b"stale partial contents")
    .await
    .unwrap();
  let (url, server) = serve_responses(vec![TestResponse {
    expected_range: Some(22),
    status: "200 OK",
    headers: String::new(),
    body: body.clone(),
  }])
  .await;
  let engine = engine(decorated_executor());
  let group_id = engine
    .submit_group(SubmitGroup {
      name: "range-ignored".into(),
      tasks: vec![task(url, &destination.path, None)],
      auto_resume: true,
    })
    .await
    .unwrap();

  assert_eq!(
    wait_finished(&engine, &group_id).await,
    FinishKind::Completed
  );
  assert_eq!(tokio::fs::read(&destination.path).await.unwrap(), body);
  server.await.unwrap();
}

#[tokio::test]
async fn failed_full_download_after_range_rejection_preserves_the_partial_file() {
  let destination = TempDownload::new("range-fallback-failed");
  let partial = b"partial";
  tokio::fs::write(destination.part_path(), partial)
    .await
    .unwrap();
  let (url, server) = serve_responses(vec![
    TestResponse {
      expected_range: Some(partial.len()),
      status: "416 Range Not Satisfiable",
      headers: String::new(),
      body: Vec::new(),
    },
    TestResponse {
      expected_range: None,
      status: "403 Forbidden",
      headers: String::new(),
      body: Vec::new(),
    },
  ])
  .await;
  let engine = engine(decorated_executor());
  let group_id = engine
    .submit_group(SubmitGroup {
      name: "range-fallback-failed".into(),
      tasks: vec![task(url, &destination.path, None)],
      auto_resume: true,
    })
    .await
    .unwrap();

  assert_eq!(wait_finished(&engine, &group_id).await, FinishKind::Failed);
  let tasks = engine.list_tasks(group_id).await.unwrap();
  assert_eq!(tasks[0].error, Some(TaskError::Http { status: 403 }));
  assert_eq!(
    tokio::fs::read(destination.part_path()).await.unwrap(),
    partial
  );
  assert!(!destination.path.exists());
  server.await.unwrap();
}

#[tokio::test]
async fn invalid_full_responses_report_structured_range_errors() {
  for resume in [false, true] {
    for (headers, expected) in [
      ("", TaskError::InvalidContentRange),
      (
        "Content-Range: bytes 1-19/20\r\n",
        TaskError::ResumeOffsetMismatch {
          expected: 0,
          actual: 1,
        },
      ),
    ] {
      let destination = TempDownload::new("invalid-full-range");
      let partial = b"partial";
      let mut responses = Vec::new();
      if resume {
        tokio::fs::write(destination.part_path(), partial)
          .await
          .unwrap();
        responses.push(TestResponse {
          expected_range: Some(partial.len()),
          status: "416 Range Not Satisfiable",
          headers: String::new(),
          body: Vec::new(),
        });
      }
      responses.push(TestResponse {
        expected_range: None,
        status: "206 Partial Content",
        headers: headers.into(),
        body: Vec::new(),
      });
      let (url, server) = serve_responses(responses).await;
      let engine = engine(decorated_executor());
      let group_id = engine
        .submit_group(SubmitGroup {
          name: "invalid-full-range".into(),
          tasks: vec![task(url, &destination.path, None)],
          auto_resume: true,
        })
        .await
        .unwrap();

      assert_eq!(wait_finished(&engine, &group_id).await, FinishKind::Failed);
      let tasks = engine.list_tasks(group_id).await.unwrap();
      assert_eq!(tasks[0].error, Some(expected));
      assert_eq!(tasks[0].attempts, 0);
      assert!(!destination.path.exists());
      if resume {
        assert_eq!(
          tokio::fs::read(destination.part_path()).await.unwrap(),
          partial
        );
      } else {
        assert!(!destination.part_path().exists());
      }
      server.await.unwrap();
    }
  }
}

#[tokio::test]
async fn a_complete_partial_file_is_finalized_on_a_matching_416() {
  let body = b"already downloaded".to_vec();
  let destination = TempDownload::new("range-complete");
  tokio::fs::write(destination.part_path(), &body)
    .await
    .unwrap();
  let (url, server) = serve_responses(vec![TestResponse {
    expected_range: Some(body.len()),
    status: "416 Range Not Satisfiable",
    headers: format!("Content-Range: bytes */{}\r\n", body.len()),
    body: Vec::new(),
  }])
  .await;
  let engine = engine(decorated_executor());
  let group_id = engine
    .submit_group(SubmitGroup {
      name: "range-complete".into(),
      tasks: vec![task(
        url,
        &destination.path,
        Some(format!("{:x}", Sha1::digest(&body))),
      )],
      auto_resume: true,
    })
    .await
    .unwrap();

  assert_eq!(
    wait_finished(&engine, &group_id).await,
    FinishKind::Completed
  );
  assert_eq!(tokio::fs::read(&destination.path).await.unwrap(), body);
  server.await.unwrap();
}

#[tokio::test]
async fn checksum_failure_removes_the_partial_file_and_fails_the_group() {
  let body = b"corrupt payload".to_vec();
  let (url, server) = serve_once(body, None, None, false).await;
  let destination = TempDownload::new("checksum-failure");
  let engine = engine(DownloadExecutor::default());
  let group_id = engine
    .submit_group(SubmitGroup {
      name: "checksum-failure".into(),
      tasks: vec![task(url, &destination.path, Some("bad-sha1".into()))],
      auto_resume: true,
    })
    .await
    .unwrap();

  assert_eq!(wait_finished(&engine, &group_id).await, FinishKind::Failed);
  assert!(!destination.path.exists());
  assert!(!destination.part_path().exists());
  let tasks = engine.list_tasks(group_id).await.unwrap();
  assert_eq!(tasks[0].state, TaskState::Failed);
  assert!(matches!(tasks[0].error, Some(TaskError::Checksum { .. })));
  server.await.unwrap();
}
