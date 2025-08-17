use super::reporter::Sink;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::time::Duration;

const TASK_PROGRESS_UPDATE_EVENT: &str = "task:progress-update";
const TASK_GROUP_UPDATE_EVENT: &str = "task:group-update";

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "status")]
pub enum TaskEventPayload {
  #[serde(rename_all = "camelCase")]
  Started {
    total: i64,
  },
  #[serde(rename_all = "camelCase")]
  InProgress {
    percent: f64,
    current: i64,
    estimated_time: Option<Duration>,
    speed: f64,
  },
  Completed,
  Stopped,
  #[serde(rename_all = "camelCase")]
  Failed {
    reason: String,
  },
  Cancelled,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskEvent<'a> {
  pub id: u32,
  pub task_group: Option<&'a str>,
  pub event: TaskEventPayload,
}

impl<'a> TaskEvent<'a> {
  pub fn emit(self, app: &AppHandle) {
    app
      .emit_to("main", TASK_PROGRESS_UPDATE_EVENT, self)
      .unwrap();
  }

  pub fn emit_started(app: &AppHandle, id: u32, task_group: Option<&'a str>, total: i64) {
    Self {
      id,
      task_group,
      event: TaskEventPayload::Started { total },
    }
    .emit(app);
  }

  pub fn emit_failed(app: &AppHandle, id: u32, task_group: Option<&'a str>, reason: String) {
    Self {
      id,
      task_group,
      event: TaskEventPayload::Failed { reason },
    }
    .emit(app);
  }

  pub fn emit_stopped(app: &AppHandle, id: u32, task_group: Option<&'a str>) {
    Self {
      id,
      task_group,
      event: TaskEventPayload::Stopped,
    }
    .emit(app);
  }

  pub fn emit_cancelled(app: &AppHandle, id: u32, task_group: Option<&'a str>) {
    Self {
      id,
      task_group,
      event: TaskEventPayload::Cancelled,
    }
    .emit(app);
  }

  pub fn emit_completed(app: &AppHandle, id: u32, task_group: Option<&'a str>) {
    Self {
      id,
      task_group,
      event: TaskEventPayload::Completed,
    }
    .emit(app);
  }

  pub fn emit_in_progress(
    app: &AppHandle,
    id: u32,
    task_group: Option<&'a str>,
    percent: f64,
    current: i64,
    estimated_time: Option<Duration>,
    speed: f64,
  ) {
    Self {
      id,
      task_group,
      event: TaskEventPayload::InProgress {
        percent,
        current,
        estimated_time,
        speed,
      },
    }
    .emit(app);
  }
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum GroupEventPayload {
  Started,
  Stopped,
  Failed,
  Completed,
  Cancelled,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GroupEvent<'a> {
  pub task_group: &'a str,
  pub event: GroupEventPayload,
}

impl<'a> GroupEvent<'a> {
  fn emit(self, app: &AppHandle) {
    app.emit_to("main", TASK_GROUP_UPDATE_EVENT, self).unwrap();
  }
  pub fn emit_group_started(app: &AppHandle, task_group: &'a str) {
    Self {
      task_group,
      event: GroupEventPayload::Started,
    }
    .emit(app);
  }
  pub fn emit_group_failed(app: &AppHandle, task_group: &'a str) {
    Self {
      task_group,
      event: GroupEventPayload::Failed,
    }
    .emit(app);
  }
  pub fn emit_group_completed(app: &AppHandle, task_group: &'a str) {
    Self {
      task_group,
      event: GroupEventPayload::Completed,
    }
    .emit(app);
  }
  pub fn emit_group_stopped(app: &AppHandle, task_group: &'a str) {
    Self {
      task_group,
      event: GroupEventPayload::Stopped,
    }
    .emit(app);
  }
  pub fn emit_group_cancelled(app: &AppHandle, task_group: &'a str) {
    Self {
      task_group,
      event: GroupEventPayload::Cancelled,
    }
    .emit(app);
  }
}

pub struct TaskEventSink {
  app: AppHandle,
}

impl TaskEventSink {
  pub fn new(app: AppHandle) -> Self {
    Self { app }
  }
}

impl Sink for TaskEventSink {
  fn report_started(&self, task_id: u32, task_group: Option<&str>, total: i64) {
    TaskEvent::emit_started(&self.app, task_id, task_group, total);
  }
  fn report_stopped(&self, task_id: u32, task_group: Option<&str>) {
    TaskEvent::emit_stopped(&self.app, task_id, task_group);
  }
  fn report_cancelled(&self, task_id: u32, task_group: Option<&str>) {
    TaskEvent::emit_cancelled(&self.app, task_id, task_group);
  }
  fn report_completion(&self, task_id: u32, task_group: Option<&str>) {
    TaskEvent::emit_completed(&self.app, task_id, task_group);
  }
  fn report_progress(
    &self,
    task_id: u32,
    task_group: Option<&str>,
    current: i64,
    total: i64,
    percentage: u32,
    estimated_time: Option<f64>,
    speed: f64,
  ) {
    TaskEvent::emit_in_progress(
      &self.app,
      task_id,
      task_group,
      percentage as f64 / 100.0,
      current,
      estimated_time.map(Duration::from_secs_f64),
      speed,
    );
  }
  fn report_failed(&self, task_id: u32, task_group: Option<&str>, reason: String) {
    TaskEvent::emit_failed(&self.app, task_id, task_group, reason);
  }
}
