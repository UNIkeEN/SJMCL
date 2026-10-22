use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::task::{Context, Waker};
use tokio::time::{Duration, Interval, interval};

use crate::tasks::streams::desc::{PDesc, PStatus};
use crate::tasks::streams::reporter::{Reporter, Sink};

pub struct PHandle<S, P>
where
  S: Sink,
  P: Clone + Serialize + for<'de> Deserialize<'de>,
{
  #[allow(dead_code)]
  pub interval: Interval,
  pub desc: PDesc<P>,
  pub path: PathBuf,
  pub reporter: Reporter<S>,
  pub waker: Option<Waker>,
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
      waker: None,
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
    self.reporter.report_started(
      self.desc.task_id,
      self.desc.task_group.as_deref(),
      self.desc.total,
    );

    // Wake up any waiting poll_next calls
    if let Some(waker) = self.waker.take() {
      waker.wake();
    }
  }

  pub fn mark_cancelled(&mut self) {
    self.desc.cancel();
    Self::drop_descriptor(&self.path);
    self
      .reporter
      .report_cancelled(self.desc.task_id, self.desc.task_group.as_deref());
  }

  pub fn mark_completed(&mut self) {
    self.desc.complete();
    Self::drop_descriptor(&self.path);
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
    Self::drop_descriptor(&self.path);
    self
      .reporter
      .report_failed(self.desc.task_id, self.desc.task_group.as_deref(), reason);
  }

  /// Remove the on-disk descriptor once a task reaches a terminal state.
  /// Descriptors are only read at startup to resume unfinished downloads, so
  /// keeping finished ones around makes every restart re-enqueue work that is
  /// already done (and would re-download files that are already complete).
  fn drop_descriptor(path: &PathBuf) {
    let _ = std::fs::remove_file(path);
  }

  pub fn status(&self) -> &PStatus {
    &self.desc.status
  }

  #[allow(dead_code)]
  pub fn store_waker(&mut self, waker: Waker) {
    self.waker = Some(waker);
  }

  pub fn set_total(&mut self, total: i64) {
    if total > self.desc.total {
      self.desc.total = total;
      self.desc.save(&self.path).unwrap();
      self.reporter.set_total(total);
    }
  }

  #[allow(dead_code)]
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
