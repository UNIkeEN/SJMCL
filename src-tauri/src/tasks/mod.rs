use crate::error::SJMCLResult;
use crate::tasks::monitor::MonitorState;
use download::DownloadParam;
use futures::stream::FusedStream;
use futures::stream::Stream;
use pin_project::pin_project;
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};
use tauri::Monitor;
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, Duration, Interval};

pub mod background;
pub mod commands;
pub mod download;
pub mod monitor;

const TASK_PROGRESS_LISTENER: &str = "SJMCL://task-progress";

#[derive(Serialize, Deserialize, Clone)]
pub enum TaskEventContent {
  Created,
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
pub struct TaskEvent<'a> {
  pub id: u32,
  pub task_group: Option<&'a str>,
  pub event: TaskEventContent,
}

impl<'a> TaskEvent<'a> {
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
    TaskEvent {
      id,
      task_group,
      event: TaskEventContent::Started { total },
    }
    .emit(app);
  }

  pub fn emit_failed(app: &AppHandle, id: u32, task_group: Option<&'a str>, reason: String) {
    TaskEvent {
      id,
      task_group,
      event: TaskEventContent::Failed { reason },
    }
    .emit(app);
  }

  pub fn emit_cancelled(app: &AppHandle, id: u32, task_group: Option<&'a str>) {
    TaskEvent {
      id,
      task_group,
      event: TaskEventContent::Cancelled,
    }
    .emit(app);
  }
  pub fn emit_completed(app: &AppHandle, id: u32, task_group: Option<&'a str>) {
    TaskEvent {
      id,
      task_group,
      event: TaskEventContent::Completed,
    }
    .emit(app);
  }
  pub fn emit_created(app: &AppHandle, id: u32, task_group: Option<&'a str>) {
    TaskEvent {
      id,
      task_group,
      event: TaskEventContent::Created,
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
    TaskEvent {
      id,
      task_group,
      event: TaskEventContent::InProgress {
        percent,
        current,
        estimated_time,
      },
    }
    .emit(app);
  }
}

#[derive(Serialize, Deserialize, Clone, Hash, PartialEq, Eq)]
pub enum TaskType {
  Download,
  Install,
  Update,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TaskState {
  pub task_id: u32,
  pub task_group: Option<String>,
  pub task_type: TaskType,
  pub current: i64,
  pub total: i64,
  #[serde(skip)]
  pub path: PathBuf,
  pub task_param: TaskParam,
  pub monitor_state: MonitorState,
}

impl TaskState {
  pub fn new(
    task_id: u32,
    task_group: Option<String>,
    task_type: TaskType,
    total: i64,
    cache_dir: PathBuf,
    task_param: TaskParam,
    monitor_state: MonitorState,
  ) -> Self {
    Self {
      task_id,
      task_group,
      task_type,
      current: 0,
      total,
      path: cache_dir.join(std::format!("states/task-{}.json", task_id)),
      task_param,
      monitor_state,
    }
  }

  pub fn load(filepath: PathBuf) -> Result<Self, std::io::Error> {
    let json_string = std::fs::read_to_string(&filepath)?;
    serde_json::from_str(&json_string)
      .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidData, "Invalid JSON"))
  }

  pub fn save(&self) -> Result<(), std::io::Error> {
    let json_string = serde_json::to_string_pretty(self)?;
    std::fs::create_dir(self.path.parent().unwrap())?;
    std::fs::write(&self.path, json_string)
  }

  pub fn delete(&self) -> Result<(), std::io::Error> {
    std::fs::remove_file(&self.path)
  }

  pub fn monitor_state(&self) -> &MonitorState {
    &self.monitor_state
  }

  #[inline]
  pub fn is_cancelled(&self) -> bool {
    self.monitor_state == MonitorState::Cancelled
  }

  #[inline]
  pub fn is_completed(&self) -> bool {
    self.monitor_state == MonitorState::Completed
  }

  #[inline]
  pub fn is_stopped(&self) -> bool {
    self.monitor_state == MonitorState::Stopped
  }

  #[inline]
  pub fn is_in_progress(&self) -> bool {
    self.monitor_state == MonitorState::InProgress
  }

  #[inline]
  pub fn cancel(&mut self) {
    self.monitor_state = MonitorState::Cancelled;
  }

  #[inline]
  pub fn stop(&mut self) {
    self.monitor_state = MonitorState::Stopped;
  }

  #[inline]
  pub fn complete(&mut self) {
    self.monitor_state = MonitorState::Completed;
  }

  #[inline]
  pub fn resume(&mut self) {
    if self.monitor_state == MonitorState::Stopped {
      self.monitor_state = MonitorState::InProgress;
    }
  }
}

#[pin_project]
pub struct ProgressStream<S, T>
where
  S: Stream<Item = T>,
{
  app_handle: AppHandle,
  task_state: Arc<Mutex<TaskState>>,
  #[pin]
  target: S,
  counter: i64,
  last_reported: i64,
  report_interval: Interval,
}

impl<S, T> ProgressStream<S, T>
where
  S: Stream<Item = T>,
{
  pub fn new(
    app_handle: AppHandle,
    target: S,
    task_state: TaskState,
    report_interval: Duration,
  ) -> Self {
    let current = task_state.current;
    Self {
      app_handle,
      target,
      task_state: Arc::new(Mutex::new(task_state)),
      counter: current,
      last_reported: 0,
      report_interval: interval(report_interval),
    }
  }
}

impl<S, T> Stream for ProgressStream<S, T>
where
  S: Stream<Item = T>,
{
  type Item = T;
  fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
    let p = self.project();

    if p.task_state.lock().unwrap().monitor_state == MonitorState::Stopped {
      return Poll::Pending;
    }

    if p.task_state.lock().unwrap().monitor_state != MonitorState::InProgress {
      return Poll::Ready(None);
    }

    p.target.poll_next(cx).map(|x| {
      if x.is_some() {
        if p.report_interval.poll_tick(cx).is_ready() {
          let mut task_state = p.task_state.lock().unwrap();
          let current = *p.counter;
          let total = task_state.total;
          let percent: f64 = (current as f64 / total as f64) * 100.0;
          task_state.current += current - *p.last_reported;
          let estimated_time = if *p.last_reported > 0 {
            Some(
              p.report_interval
                .period()
                .mul_f64((total - current) as f64 / (current - *p.last_reported) as f64),
            )
          } else {
            None
          };
          *p.last_reported = current;
          TaskEvent::emit_in_progress(
            p.app_handle,
            task_state.task_id,
            task_state.task_group.as_deref(),
            percent,
            current,
            estimated_time,
          );
          task_state.save().unwrap();
        }
      } else {
        p.task_state.lock().unwrap().monitor_state = MonitorState::Completed;
      }
      x
    })
  }
}

impl<S, T> FusedStream for ProgressStream<S, T>
where
  S: Stream<Item = T>,
{
  fn is_terminated(&self) -> bool {
    self.task_state.lock().unwrap().monitor_state != MonitorState::InProgress
  }
}

impl<S, T> ProgressStream<S, T>
where
  S: Stream<Item = T>,
{
  pub fn state(&self) -> Arc<Mutex<TaskState>> {
    self.task_state.clone()
  }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "task_type")]
pub enum TaskParam {
  Download(DownloadParam),
}
