use sjmcl_downloader::{
  EngineEvent, FinishKind, GroupState, GroupStats, SubmitGroup, SubmitTask, Task, TaskState,
};

#[test]
fn accepts_the_camel_case_tauri_submission_contract() {
  let payload = serde_json::json!({
    "name": "assets",
    "autoResume": true,
    "tasks": [{
      "name": "index.json",
      "executor": "download",
      "spec": { "url": "http://localhost/index.json" },
      "dest": "/tmp/index.json",
      "sha1": "0123456789abcdef0123456789abcdef01234567"
    }]
  });

  let group: SubmitGroup = serde_json::from_value(payload).unwrap();
  assert!(group.auto_resume);
  assert_eq!(
    group.tasks[0].sha1.as_deref(),
    Some("0123456789abcdef0123456789abcdef01234567")
  );
  assert_eq!(group.tasks[0].sha256, None);
}

#[test]
fn emits_camel_case_task_and_event_fields() {
  let submit = SubmitTask {
    name: "client.jar".into(),
    executor: "download".into(),
    spec: serde_json::json!({ "url": "http://localhost/client.jar" }),
    dest: Some("/tmp/client.jar".into()),
    sha1: None,
    sha256: None,
  };
  let mut task = Task::new("t1".into(), "g1".into(), &submit);
  task.state = TaskState::Done;
  let task_json = serde_json::to_value(task).unwrap();
  assert_eq!(task_json["groupId"], "g1");
  assert!(task_json.get("group_id").is_none());
  assert!(task_json.get("retriesExhausted").is_some());

  let event = EngineEvent::GroupFinished {
    group_id: "g1".into(),
    finish: FinishKind::Completed,
    failed_tasks: Vec::new(),
    summary: GroupStats {
      total: 1,
      done: 1,
      ..GroupStats::default()
    },
  };
  let event_json = serde_json::to_value(event).unwrap();
  assert_eq!(event_json["kind"], "group_finished");
  assert_eq!(event_json["groupId"], "g1");
  assert!(event_json.get("failedTasks").is_some());

  let state_event = EngineEvent::GroupStateChanged {
    group_id: "g1".into(),
    old: GroupState::Active,
    new: GroupState::Finished,
  };
  assert_eq!(serde_json::to_value(state_event).unwrap()["groupId"], "g1");

  let submitted_event = EngineEvent::GroupSubmitted {
    group_id: "g2".into(),
  };
  let submitted_json = serde_json::to_value(submitted_event).unwrap();
  assert_eq!(submitted_json["kind"], "group_submitted");
  assert_eq!(submitted_json["groupId"], "g2");
}
