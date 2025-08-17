use super::{
  events::{GroupEvent, TaskEvent},
  monitor::{RuntimeGroupState, RuntimeTaskDesc},
};
use log::info;
use std::time::Duration;
use tauri::AppHandle;

pub trait Sink {
  fn report_progress(
    &self,
    task_id: u32,
    task_group: Option<&str>,
    current: i64,
    total: i64,
    percentage: u32,
    estimated_time: Option<f64>,
    speed: f64,
  );
  fn report_completion(&self, task_id: u32, task_group: Option<&str>);
  fn report_stopped(&self, task_id: u32, task_group: Option<&str>);
  fn report_cancelled(&self, task_id: u32, task_group: Option<&str>);
  fn report_started(&self, task_id: u32, task_group: Option<&str>, total: i64);
  fn report_failed(&self, task_id: u32, task_group: Option<&str>, reason: String);
}

pub struct TaskReporter {
  app: AppHandle,
  id: u32,
  group: Option<String>,
  total: i64,
  last_reported: i64,
  period: Duration,
}

impl TaskReporter {
  pub fn new(app: AppHandle, id: u32, group: Option<String>, total: i64, period: Duration) -> Self {
    Self {
      app,
      id,
      group,
      total,
      last_reported: 0,
      period,
    }
  }

  pub fn set_total(&mut self, total: i64) {
    self.total = total;
  }

  pub fn from_desc_interval(
    app: AppHandle,
    group: Option<String>,
    desc: &RuntimeTaskDesc,
    period: &Duration,
  ) -> Self {
    Self {
      app,
      id: desc.id,
      group,
      total: desc.total as i64,
      last_reported: desc.current as i64,
      period: *period,
    }
  }
}

impl TaskReporter {
  pub fn report(&mut self, desc: &RuntimeTaskDesc) {
    if desc.current as i64 > self.last_reported {
      self.report_progress(desc.current as i64);
    }

    match desc.state {
      RuntimeGroupState::InProgress => self.report_started(desc.total as i64),
      RuntimeGroupState::Cancelled => self.report_canceled(),
      RuntimeGroupState::Stopped { .. } => self.report_stopped(),
      RuntimeGroupState::Failed { ref reason } => self.report_failed(reason.clone()),
      RuntimeGroupState::Completed { .. } => self.report_completion(),
      _ => {}
    }
  }

  pub fn report_started(&mut self, total: i64) {
    self.total = total;
    TaskEvent::emit_started(&self.app, self.id, self.group.as_deref(), total);
  }
  pub fn report_stopped(&self) {
    TaskEvent::emit_stopped(&self.app, self.id, self.group.as_deref());
  }

  pub fn report_canceled(&self) {
    TaskEvent::emit_cancelled(&self.app, self.id, self.group.as_deref());
  }

  pub fn report_completion(&self) {
    TaskEvent::emit_completed(&self.app, self.id, self.group.as_deref());
  }

  pub fn report_progress(&mut self, current: i64) {
    if current > self.total {
      return;
    }
    let percentage = if self.total > 0 {
      (current as f64 / self.total as f64 * 100.0).round() as u32
    } else {
      0
    };

    let estimated_time = if self.last_reported > 0 && current > self.last_reported {
      Some(
        (self.total - current) as f64 / (current - self.last_reported) as f64
          * self.period.as_secs_f64(),
      )
    } else {
      None
    };
    let speed = (current - self.last_reported) as f64 / self.period.as_secs_f64();

    TaskEvent::emit_in_progress(
      &self.app,
      self.id,
      self.group.as_deref(),
      percentage as f64 / 100.0,
      current,
      estimated_time.map(Duration::from_secs_f64),
      speed,
    );

    self.last_reported = current;
  }

  pub fn report_failed(&self, reason: String) {
    TaskEvent::emit_failed(&self.app, self.id, self.group.as_deref(), reason);
  }
}

#[derive(Clone)]
pub struct GroupReporter {
  app: AppHandle,
  group: String,
}

impl GroupReporter {
  pub fn new(app: AppHandle, group: String) -> Self {
    Self { app, group }
  }

  pub fn report(&self, state: &RuntimeGroupState) {
    match *state {
      RuntimeGroupState::InProgress => self.report_group_started(),
      RuntimeGroupState::Cancelled => self.report_group_cancelled(),
      RuntimeGroupState::Stopped { .. } => self.report_group_stopped(),
      RuntimeGroupState::Failed { .. } => self.report_group_failed(),
      RuntimeGroupState::Completed { .. } => self.report_group_completed(),
      _ => {}
    }
  }

  fn report_group_started(&self) {
    GroupEvent::emit_group_started(&self.app, &self.group);
  }

  fn report_group_failed(&self) {
    GroupEvent::emit_group_failed(&self.app, &self.group);
  }

  fn report_group_completed(&self) {
    GroupEvent::emit_group_completed(&self.app, &self.group);
  }

  fn report_group_cancelled(&self) {
    GroupEvent::emit_group_cancelled(&self.app, &self.group);
  }

  fn report_group_stopped(&self) {
    GroupEvent::emit_group_stopped(&self.app, &self.group);
  }
}
