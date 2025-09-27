use crate::tasks::streams::reporter::Sink;
use crate::tasks::{PTaskDesc, THandle};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::time::Duration;

const TASK_PROGRESS_UPDATE_EVENT: &str = "task:progress-update";
const TASK_GROUP_UPDATE_EVENT: &str = "task:group-update";

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "status")]
pub enum PEventStatus {
  #[serde(rename_all = "camelCase")]
  Created {
    desc: PTaskDesc,
  },
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
pub struct PEvent<'a> {
  pub id: u32,
  pub task_group: Option<&'a str>,
  pub event: PEventStatus,
}

impl<'a> PEvent<'a> {
  pub fn emit(self, app: &AppHandle) {
    app
      .emit_to("main", TASK_PROGRESS_UPDATE_EVENT, self)
      .unwrap();
  }

  pub fn emit_started(app: &AppHandle, id: u32, task_group: Option<&'a str>, total: i64) {
    Self {
      id,
      task_group,
      event: PEventStatus::Started { total },
    }
    .emit(app);
  }

  pub fn emit_failed(app: &AppHandle, id: u32, task_group: Option<&'a str>, reason: String) {
    Self {
      id,
      task_group,
      event: PEventStatus::Failed { reason },
    }
    .emit(app);
  }

  pub fn emit_stopped(app: &AppHandle, id: u32, task_group: Option<&'a str>) {
    Self {
      id,
      task_group,
      event: PEventStatus::Stopped,
    }
    .emit(app);
  }

  pub fn emit_cancelled(app: &AppHandle, id: u32, task_group: Option<&'a str>) {
    Self {
      id,
      task_group,
      event: PEventStatus::Cancelled,
    }
    .emit(app);
  }

  pub fn emit_completed(app: &AppHandle, id: u32, task_group: Option<&'a str>) {
    Self {
      id,
      task_group,
      event: PEventStatus::Completed,
    }
    .emit(app);
  }

  pub fn emit_created(app: &AppHandle, id: u32, task_group: Option<&'a str>, desc: PTaskDesc) {
    Self {
      id,
      task_group,
      event: PEventStatus::Created { desc },
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
      event: PEventStatus::InProgress {
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
pub enum GEventStatus {
  Started,
  Stopped,
  Failed,
  Completed,
  Cancelled,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GEvent<'a> {
  pub task_group: &'a str,
  pub event: GEventStatus,
}

impl<'a> GEvent<'a> {
  fn emit(self, app: &AppHandle) {
    app.emit_to("main", TASK_GROUP_UPDATE_EVENT, self).unwrap();
  }
  pub fn emit_group_started(app: &AppHandle, task_group: &'a str) {
    Self {
      task_group,
      event: GEventStatus::Started,
    }
    .emit(app);
  }
  pub fn emit_group_failed(app: &AppHandle, task_group: &'a str) {
    Self {
      task_group,
      event: GEventStatus::Failed,
    }
    .emit(app);
  }
  pub fn emit_group_completed(app: &AppHandle, task_group: &'a str) {
    Self {
      task_group,
      event: GEventStatus::Completed,
    }
    .emit(app);
  }
  pub fn emit_group_stopped(app: &AppHandle, task_group: &'a str) {
    Self {
      task_group,
      event: GEventStatus::Stopped,
    }
    .emit(app);
  }
  pub fn emit_group_cancelled(app: &AppHandle, task_group: &'a str) {
    Self {
      task_group,
      event: GEventStatus::Cancelled,
    }
    .emit(app);
  }
}

pub struct TauriEventSink {
  app: AppHandle,
}

impl TauriEventSink {
  pub fn new(app: AppHandle) -> Self {
    Self { app }
  }
}

impl Sink for TauriEventSink {
  fn report_started(&self, task_id: u32, task_group: Option<&str>, total: i64) {
    PEvent::emit_started(&self.app, task_id, task_group, total);
  }
  fn report_stopped(&self, task_id: u32, task_group: Option<&str>) {
    PEvent::emit_stopped(&self.app, task_id, task_group);
  }
  fn report_cancelled(&self, task_id: u32, task_group: Option<&str>) {
    PEvent::emit_cancelled(&self.app, task_id, task_group);
  }
  fn report_completion(&self, task_id: u32, task_group: Option<&str>) {
    PEvent::emit_completed(&self.app, task_id, task_group);
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
    PEvent::emit_in_progress(
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
    PEvent::emit_failed(&self.app, task_id, task_group, reason);
  }
}

#[derive(Serialize, Clone)]
pub struct TEvent<'a> {
  pub id: u32,
  pub task_group: Option<&'a str>,
  pub state: &'a str,
}

impl<'a> TEvent<'a> {
  pub fn new(desc: &'a THandle) -> Self {
    Self {
      id: desc.task_id,
      task_group: desc.task_group.as_deref(),
      state: desc.state.as_str(),
    }
  }
  pub fn emit(self, app: &AppHandle) {
    if let Some(tg) = self.task_group {
      app.emit_to("main", tg, self).unwrap();
    } else {
      app
        .emit_to("main", std::format!("task-{}", self.id).as_str(), self)
        .unwrap();
    }
  }
}
