use super::desc::{PDesc, PStatus};
use super::reporter::{Reporter, Sink};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::task::Context;
use tokio::time::{interval, Duration, Interval};

pub struct PHandle<S, P>
where
  S: Sink,
  P: Clone + Serialize + for<'de> Deserialize<'de>,
{
  pub interval: Interval,
  pub desc: PDesc<P>,
  pub path: PathBuf,
  pub reporter: Reporter<S>,
}

impl<S, P> PHandle<S, P>
where
  S: Sink,
  P: Clone + Serialize + for<'de> Deserialize<'de>,
{
  pub fn new(desc: PDesc<P>, duration: Duration, path: PathBuf, reporter: Reporter<S>) -> Self {
    Self {
      interval: interval(duration),
      desc,
      path,
      reporter,
    }
  }

  pub fn mark_stopped(&mut self) {
    self.desc.stop();
    self.desc.save(&self.path).unwrap();
    self
      .reporter
      .report_stopped(self.desc.task_id, self.desc.task_group.as_deref());
  }

  pub fn mark_resumed(&mut self) {
    self.desc.resume();
    self.desc.save(&self.path).unwrap();
    self
      .reporter
      .report_resumed(self.desc.task_id, self.desc.task_group.as_deref());
  }

  pub fn mark_cancelled(&mut self) {
    self.desc.cancel();
    self.desc.save(&self.path).unwrap();
    self
      .reporter
      .report_cancelled(self.desc.task_id, self.desc.task_group.as_deref());
  }

  pub fn mark_completed(&mut self) {
    self.desc.complete();
    self.desc.save(&self.path).unwrap();
    self
      .reporter
      .report_completion(self.desc.task_id, self.desc.task_group.as_deref());
  }

  pub fn mark_started(&mut self) {
    self.desc.start();
    self.desc.save(&self.path).unwrap();
    self.reporter.report_started(
      self.desc.task_id,
      self.desc.task_group.as_deref(),
      self.desc.total,
    );
  }

  pub fn mark_failed(&mut self, reason: String) {
    self.desc.fail();
    self.desc.save(&self.path).unwrap();
    self
      .reporter
      .report_failed(self.desc.task_id, self.desc.task_group.as_deref(), reason);
  }

  pub fn status(&self) -> &PStatus {
    &self.desc.status
  }

  pub fn set_total(&mut self, total: i64) {
    self.desc.total = total;
    self.desc.save(&self.path).unwrap();
    self.reporter.set_total(total);
  }

  pub fn report_progress(&mut self, cx: &mut Context<'_>, incr: i64) {
    self.desc.increment_progress(incr);
    if self.interval.poll_tick(cx).is_ready() {
      self.desc.save(&self.path).unwrap();
      self.reporter.report_progress(
        self.desc.task_id,
        self.desc.task_group.as_deref(),
        self.desc.current,
      );
    }
  }
}
