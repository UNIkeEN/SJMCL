use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::tasks::events::GEventStatus;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PDesc<T>
where
  T: Clone + Serialize,
{
  pub task_id: u32,
  pub task_group: Option<String>,
  pub total: i64,
  pub current: i64,
  pub payload: T,
  pub status: PStatus,
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PStatus {
  Waiting,
  Stopped,
  Cancelled,
  Completed,
  InProgress,
  Failed,
}

impl PStatus {
  pub fn is_terminated(&self) -> bool {
    matches!(self, PStatus::Cancelled | PStatus::Completed)
  }

  pub fn is_stopped(&self) -> bool {
    *self == PStatus::Stopped
  }

  pub fn is_completed(&self) -> bool {
    *self == PStatus::Completed
  }

  pub fn is_in_progress(&self) -> bool {
    *self == PStatus::InProgress
  }

  pub fn is_cancelled(&self) -> bool {
    *self == PStatus::Cancelled
  }

  pub fn is_waiting(&self) -> bool {
    *self == PStatus::Waiting
  }
}

impl<T> PDesc<T>
where
  T: Clone + Serialize + for<'de> Deserialize<'de>,
{
  pub fn new(
    task_id: u32,
    task_group: Option<String>,
    total: i64,
    payload: T,
    status: PStatus,
  ) -> Self {
    Self {
      task_id,
      task_group,
      total,
      current: 0,
      payload,
      status,
    }
  }
  pub fn save(&self, path: &PathBuf) -> std::io::Result<()> {
    let file = std::fs::File::create(path)?;
    serde_json::to_writer(file, self)?;
    Ok(())
  }

  pub fn load(path: &PathBuf) -> std::io::Result<Self> {
    let file = std::fs::File::open(path)?;
    let desc: Self = serde_json::from_reader(file)?;
    Ok(desc)
  }

  pub fn increment_progress(&mut self, size: i64) {
    if self.status != PStatus::InProgress {
      return;
    }
    self.current += size;
  }

  pub fn start(&mut self) {
    self.status = PStatus::InProgress
  }

  pub fn stop(&mut self) {
    if self.status == PStatus::InProgress || self.status == PStatus::Waiting {
      self.status = PStatus::Stopped
    }
  }

  pub fn cancel(&mut self) {
    self.status = PStatus::Cancelled
  }

  pub fn resume(&mut self) {
    if self.status == PStatus::Stopped {
      self.status = PStatus::InProgress
    }
  }

  pub fn complete(&mut self) {
    self.status = PStatus::Completed;
  }

  pub fn fail(&mut self) {
    self.status = PStatus::Failed;
  }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GDesc<T>
where
  T: Clone + Serialize,
{
  pub task_group: String,
  pub task_descs: Vec<PDesc<T>>,
  pub status: GEventStatus,
}
