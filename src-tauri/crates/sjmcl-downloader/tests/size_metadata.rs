use sjmcl_downloader::{SubmitTask, Task, TaskState};

fn task(executor: &str, spec: serde_json::Value) -> Task {
  Task::new(
    "t1".into(),
    "g1".into(),
    &SubmitTask {
      name: "file".into(),
      executor: executor.into(),
      spec,
      dest: None,
      sha1: None,
      sha256: None,
    },
  )
}

#[test]
fn queued_downloads_expose_manifest_sizes_before_starting() {
  let task = task(
    "download",
    serde_json::json!({ "url": "https://example.com/file", "size": 123456 }),
  );
  assert_eq!(task.state, TaskState::Pending);
  assert_eq!(task.received, 0);
  assert_eq!(task.total, 123456);
}

#[test]
fn unknown_or_invalid_sizes_remain_unknown() {
  for spec in [
    serde_json::json!({}),
    serde_json::json!({ "size": null }),
    serde_json::json!({ "size": -1 }),
  ] {
    assert_eq!(task("download", spec).total, 0);
  }
}

#[test]
fn size_metadata_does_not_apply_to_installation_steps() {
  assert_eq!(
    task("install", serde_json::json!({ "size": 123456 })).total,
    0
  );
}
