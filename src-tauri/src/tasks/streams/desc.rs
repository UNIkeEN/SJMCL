use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
pub struct PDesc<T>
where
  T: Clone + Serialize,
{
  pub task_id: u32,
  pub task_group: Option<String>,
  pub total: i64,
  pub current: i64,
  pub payload: T,
  pub state: PState,
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PState {
  Stopped,
  Cancelled,
  Completed,
  InProgress,
  Failed,
}

impl PState {
  pub fn is_terminated(&self) -> bool {
    matches!(self, PState::Cancelled | PState::Completed)
  }

  pub fn is_stopped(&self) -> bool {
    return *self == PState::Stopped;
  }

  pub fn is_completed(&self) -> bool {
    return *self == PState::Completed;
  }

  pub fn is_in_progress(&self) -> bool {
    return *self == PState::InProgress;
  }

  pub fn is_cancelled(&self) -> bool {
    return *self == PState::Cancelled;
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
    state: PState,
  ) -> Self {
    Self {
      task_id,
      task_group,
      total,
      current: 0,
      payload,
      state,
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
    if self.state != PState::InProgress {
      return;
    }
    self.current += size;
  }

  pub fn start(&mut self) {
    self.state = PState::InProgress
  }

  pub fn stop(&mut self) {
    if self.state == PState::InProgress {
      self.state = PState::Stopped
    }
  }

  pub fn cancel(&mut self) {
    self.state = PState::Cancelled
  }

  pub fn resume(&mut self) {
    if self.state == PState::Stopped {
      self.state = PState::InProgress
    }
  }

  pub fn complete(&mut self) {
    self.state = PState::Completed;
  }

  pub fn fail(&mut self) {
    self.state = PState::Failed;
  }
}
