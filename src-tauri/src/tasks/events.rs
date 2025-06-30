use super::streams::reporter::Sink;
use super::PTaskDesc;
use super::THandle;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::time::Duration;

const TASK_PROGRESS_LISTENER: &str = "SJMCL://task-progress";

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "state")]
pub enum PEventPayload {
  Created(PTaskDesc),
  Started {
    total: i64,
  },
  InProgress {
    percent: f64,
    current: i64,
    estimated_time: Option<Duration>,
  },
  Completed,
  Stopped,
  Failed {
    reason: String,
  },
  Cancelled,
}

#[derive(Serialize, Clone)]
pub struct PEvent<'a> {
  pub id: u32,
  pub task_group: Option<&'a str>,
  pub event: PEventPayload,
}

impl<'a> PEvent<'a> {
  pub fn emit(self, app: &AppHandle) {
    if let Some(tg) = self.task_group {
      app.emit_to(TASK_PROGRESS_LISTENER, tg, self).unwrap();
    } else {
      app
        .emit_to(
          TASK_PROGRESS_LISTENER,
          std::format!("task-{}", self.id).as_str(),
          self,
        )
        .unwrap();
    }
  }

  pub fn emit_started(app: &AppHandle, id: u32, task_group: Option<&'a str>, total: i64) {
    Self {
      id,
      task_group,
      event: PEventPayload::Started { total },
    }
    .emit(app);
  }

  pub fn emit_failed(app: &AppHandle, id: u32, task_group: Option<&'a str>, reason: String) {
    Self {
      id,
      task_group,
      event: PEventPayload::Failed { reason },
    }
    .emit(app);
  }

  pub fn emit_cancelled(app: &AppHandle, id: u32, task_group: Option<&'a str>) {
    Self {
      id,
      task_group,
      event: PEventPayload::Cancelled,
    }
    .emit(app);
  }
  pub fn emit_completed(app: &AppHandle, id: u32, task_group: Option<&'a str>) {
    Self {
      id,
      task_group,
      event: PEventPayload::Completed,
    }
    .emit(app);
  }
  pub fn emit_created(app: &AppHandle, id: u32, task_group: Option<&'a str>, desc: PTaskDesc) {
    Self {
      id,
      task_group,
      event: PEventPayload::Created(desc),
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
  ) {
    Self {
      id,
      task_group,
      event: PEventPayload::InProgress {
        percent,
        current,
        estimated_time,
      },
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
    PEvent::emit_cancelled(&self.app, task_id, task_group);
  }
  fn report_resumed(&self, task_id: u32, task_group: Option<&str>) {
    PEvent::emit_started(&self.app, task_id, task_group, 0);
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
      estimated_time.map(|et| Duration::from_secs_f64(et)),
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
      app.emit_to(TASK_PROGRESS_LISTENER, tg, self).unwrap();
    } else {
      app
        .emit_to(
          TASK_PROGRESS_LISTENER,
          std::format!("task-{}", self.id).as_str(),
          self,
        )
        .unwrap();
    }
  }
}
