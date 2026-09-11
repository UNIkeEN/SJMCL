//! `EngineActor` is the engine's sole event loop and state owner.
//!
//! It consumes two input channels and two timers:
//!   - cmds for frontend commands;
//!   - reports from workers;
//!   - dispatch ticks for activating groups and dispatching the ready queue;
//!   - emit ticks for coalescing progress into a Tick event.
//!
//! Rules:
//!   - Only the actor emits events through `EventSink`.
//!   - Workers report through `TaskReport` and never access state directly.
//!   - Control operations cancel `CancellationToken`s: `start_token` for queued jobs and
//!     `run_token` for in-flight jobs.
//!   - A task failure puts its group into Draining: stop scheduling, drain in-flight jobs, and
//!     cancel pending jobs.

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::Instant;

use tokio::sync::{mpsc, oneshot};
use tokio::time::{MissedTickBehavior, interval};
use tokio_util::sync::CancellationToken;

use crate::command::{Command, Reply};
use crate::event::{EngineEvent, EventSink};
use crate::executor::{ExecutorRegistry, Job, Registry, spawn_worker_pool};
use crate::model::{
  CancelReason, EngineConfig, EngineError, FinishKind, GroupState, RuntimeGroup, RuntimeTask, Task,
  TaskError, TaskGroup, TaskState,
};
use crate::storage::StateStore;
use crate::{ExecContext, GroupSummary, Progress, TaskOutcome, TaskReport};

/// Frontend handle containing only the command sender.
pub struct Engine {
  tx: mpsc::Sender<Command>,
}

impl Engine {
  pub fn builder(
    cfg: EngineConfig,
    sink: Arc<dyn EventSink>,
    store: Arc<dyn StateStore>,
  ) -> EngineBuilder {
    EngineBuilder::new(cfg, sink, store)
  }

  pub async fn submit_group(&self, g: crate::SubmitGroup) -> Result<String, EngineError> {
    let (tx, rx) = oneshot::channel();
    self
      .tx
      .send(Command::SubmitGroup(g, tx))
      .await
      .map_err(|_| EngineError::ChannelClosed)?;
    rx.await.map_err(|_| EngineError::ChannelClosed)?
  }

  pub async fn pause(&self, group_id: String) -> Result<(), EngineError> {
    let (tx, rx) = oneshot::channel();
    self
      .send(Command::Pause {
        group_id,
        reply: tx,
      })
      .await?;
    rx.await.map_err(|_| EngineError::ChannelClosed)?
  }

  pub async fn resume(&self, group_id: String) -> Result<(), EngineError> {
    let (tx, rx) = oneshot::channel();
    self
      .send(Command::Resume {
        group_id,
        reply: tx,
      })
      .await?;
    rx.await.map_err(|_| EngineError::ChannelClosed)?
  }

  pub async fn cancel(&self, group_id: String) -> Result<(), EngineError> {
    let (tx, rx) = oneshot::channel();
    self
      .send(Command::Cancel {
        group_id,
        reply: tx,
      })
      .await?;
    rx.await.map_err(|_| EngineError::ChannelClosed)?
  }

  pub async fn retry(&self, group_id: String) -> Result<(), EngineError> {
    let (tx, rx) = oneshot::channel();
    self
      .send(Command::Retry {
        group_id,
        reply: tx,
      })
      .await?;
    rx.await.map_err(|_| EngineError::ChannelClosed)?
  }

  pub async fn remove(&self, group_id: String) -> Result<(), EngineError> {
    let (tx, rx) = oneshot::channel();
    self
      .send(Command::Remove {
        group_id,
        reply: tx,
      })
      .await?;
    rx.await.map_err(|_| EngineError::ChannelClosed)?
  }

  pub async fn snapshot(&self) -> Result<Vec<GroupSummary>, EngineError> {
    let (tx, rx) = oneshot::channel();
    self
      .tx
      .send(Command::Snapshot(tx))
      .await
      .map_err(|_| EngineError::ChannelClosed)?;
    rx.await.map_err(|_| EngineError::ChannelClosed)
  }

  pub async fn list_tasks(&self, group_id: String) -> Result<Vec<Task>, EngineError> {
    let (tx, rx) = oneshot::channel();
    self
      .tx
      .send(Command::ListTasks {
        group_id,
        reply: tx,
      })
      .await
      .map_err(|_| EngineError::ChannelClosed)?;
    rx.await.map_err(|_| EngineError::ChannelClosed)?
  }

  async fn send(&self, cmd: Command) -> Result<(), EngineError> {
    self
      .tx
      .send(cmd)
      .await
      .map_err(|_| EngineError::ChannelClosed)
  }
}

pub struct EngineBuilder {
  cfg: EngineConfig,
  sink: Arc<dyn EventSink>,
  store: Arc<dyn StateStore>,
  executors: Registry,
}

impl EngineBuilder {
  pub fn new(cfg: EngineConfig, sink: Arc<dyn EventSink>, store: Arc<dyn StateStore>) -> Self {
    EngineBuilder {
      cfg,
      sink,
      store,
      executors: Registry::new(),
    }
  }

  pub fn register(&mut self, ex: Arc<dyn crate::executor::TaskExecutor>) -> &mut Self {
    self.executors.insert(ex);
    self
  }

  pub fn spawn(self) -> (Engine, tokio::task::JoinHandle<()>) {
    let (cmd_tx, cmd_rx) = mpsc::channel(256);
    let (report_tx, report_rx) = mpsc::channel(1024);
    let executors: Arc<dyn ExecutorRegistry> = Arc::new(self.executors);
    let (worker_handles, ready_tx) = spawn_worker_pool(executors.clone(), self.cfg.concurrency);

    let mut actor = EngineActor {
      cfg: self.cfg,
      sink: self.sink,
      store: self.store,
      executors,
      cmd_rx,
      report_rx,
      report_tx,
      ready_tx,
      self_tx: cmd_tx.clone(),
      state: EngineState::default(),
      seq: 0,
      _worker_handles: worker_handles,
    };
    // Restore persisted groups after restart, leaving non-terminal groups Paused until resumed.
    if let Ok(mut groups) = actor.store.load_all() {
      crate::storage::reconcile_after_restart(&mut groups);
      actor.seq = groups
        .iter()
        .flat_map(|g| std::iter::once(&g.id).chain(g.tasks.iter().map(|t| &t.id)))
        .filter_map(|id| id.get(1..)?.parse::<u64>().ok())
        .max()
        .unwrap_or(0);
      for g in groups {
        if let Err(e) = actor.store.save_group(&g) {
          tracing::warn!("persist reconciled group failed: {e}");
        }
        if !actor.state.groups.iter().any(|x| x.id == g.id) {
          actor.state.groups.push(g);
        }
      }
      let ids: Vec<String> = actor.state.groups.iter().map(|g| g.id.clone()).collect();
      for id in ids {
        actor.init_runtime(&id);
      }
    }
    let handle = tokio::spawn(actor.run());
    (Engine { tx: cmd_tx }, handle)
  }
}

#[derive(Default)]
struct EngineState {
  groups: Vec<TaskGroup>,
  runtime: HashMap<String, RuntimeGroup>,
  /// Global ready queue of task IDs in submission order.
  ready: VecDeque<String>,
}

struct EngineActor {
  cfg: EngineConfig,
  sink: Arc<dyn EventSink>,
  store: Arc<dyn StateStore>,
  executors: Arc<dyn ExecutorRegistry>,
  cmd_rx: mpsc::Receiver<Command>,
  report_rx: mpsc::Receiver<TaskReport>,
  report_tx: mpsc::Sender<TaskReport>,
  ready_tx: async_channel::Sender<Job>,
  /// Actor's own sender for internal delayed retries.
  self_tx: mpsc::Sender<Command>,
  state: EngineState,
  seq: u64,
  _worker_handles: Vec<tokio::task::JoinHandle<()>>,
}

impl EngineActor {
  async fn run(mut self) {
    let mut dispatch = interval(self.cfg.dispatch_interval);
    let mut emit = interval(self.cfg.emit_interval);
    dispatch.set_missed_tick_behavior(MissedTickBehavior::Skip);
    emit.set_missed_tick_behavior(MissedTickBehavior::Skip);
    loop {
      tokio::select! {
          cmd = self.cmd_rx.recv() => match cmd {
              Some(c) => self.handle_cmd(c),
              None => break,
          },
          rep = self.report_rx.recv() => match rep {
              Some(r) => self.handle_report(r),
              None => break,
          },
          _ = dispatch.tick() => self.dispatch_step(),
          _ = emit.tick() => self.emit_progress(),
      }
    }
    tracing::info!("engine actor stopped");
  }

  // ---------- Queries and utilities ----------

  fn find(&self, task_id: &str) -> Option<(usize, usize)> {
    for (gi, g) in self.state.groups.iter().enumerate() {
      for (ti, t) in g.tasks.iter().enumerate() {
        if t.id == task_id {
          return Some((gi, ti));
        }
      }
    }
    None
  }

  fn emit(&self, ev: EngineEvent) {
    self.sink.emit(&ev);
  }

  fn init_runtime(&mut self, group_id: &str) {
    let mut rtg = RuntimeGroup::new();
    if let Some(g) = self.state.groups.iter().find(|g| g.id == group_id) {
      for t in &g.tasks {
        rtg.tasks.insert(
          t.id.clone(),
          RuntimeTask {
            start_token: CancellationToken::new(),
            run_token: CancellationToken::new(),
            queued: false,
            speed_ema: 0.0,
            prev_received: t.received,
            prev_at: None,
          },
        );
      }
    }
    self.state.runtime.insert(group_id.to_string(), rtg);
  }

  // ---------- Command handling ----------

  fn handle_cmd(&mut self, cmd: Command) {
    match cmd {
      Command::SubmitGroup(sg, reply) => self.cmd_submit(sg, reply),
      Command::Pause { group_id, reply } => {
        let r = self.cmd_pause(&group_id);
        let _ = reply.send(r);
      }
      Command::Resume { group_id, reply } => {
        let r = self.cmd_resume(&group_id);
        let _ = reply.send(r);
      }
      Command::Cancel { group_id, reply } => {
        let r = self.cmd_cancel(&group_id);
        let _ = reply.send(r);
      }
      Command::Retry { group_id, reply } => {
        let r = self.cmd_retry(&group_id);
        let _ = reply.send(r);
      }
      Command::Remove { group_id, reply } => {
        let r = self.cmd_remove(&group_id);
        let _ = reply.send(r);
      }
      Command::RetryTask { group_id, task_id } => self.cmd_retry_task(&group_id, &task_id),
      Command::Snapshot(reply) => {
        let snap: Vec<GroupSummary> = self
          .state
          .groups
          .iter()
          .map(|g| GroupSummary {
            id: g.id.clone(),
            name: g.name.clone(),
            state: g.state,
            finish: g.finish,
            stats: g.stats(),
          })
          .collect();
        let _ = reply.send(snap);
      }
      Command::ListTasks { group_id, reply } => {
        let r = self
          .state
          .groups
          .iter()
          .find(|g| g.id == group_id)
          .map(|g| g.tasks.clone())
          .ok_or(EngineError::UnknownGroup(group_id));
        let _ = reply.send(r);
      }
    }
  }

  fn cmd_submit(&mut self, sg: crate::SubmitGroup, reply: Reply<String>) {
    if sg.tasks.is_empty() {
      let _ = reply.send(Err(EngineError::InvalidSubmission(
        "任务组至少需要一个任务".into(),
      )));
      return;
    }
    // Validate that the executor exists.
    for t in &sg.tasks {
      if self.executors.get(&t.executor).is_none() {
        let _ = reply.send(Err(EngineError::UnknownExecutor(t.executor.clone())));
        return;
      }
    }
    self.seq += 1;
    let gid = format!("g{}", self.seq);
    let tasks: Vec<Task> = sg
      .tasks
      .iter()
      .map(|st| {
        self.seq += 1;
        Task::new(format!("t{}", self.seq), gid.clone(), st)
      })
      .collect();
    let group = TaskGroup {
      id: gid.clone(),
      name: sg.name,
      auto_resume: sg.auto_resume,
      state: GroupState::Queued,
      finish: None,
      tasks,
    };
    self.state.groups.push(group);
    self.init_runtime(&gid);
    if let Err(e) = self
      .store
      .save_group(self.state.groups.iter().find(|g| g.id == gid).unwrap())
    {
      tracing::warn!("persist submit failed: {e}");
    }
    self.emit(EngineEvent::GroupSubmitted {
      group_id: gid.clone(),
    });
    // Activate immediately if capacity is available.
    self.try_activate_next_group();
    let _ = reply.send(Ok(gid));
  }

  fn cmd_pause(&mut self, group_id: &str) -> Result<(), EngineError> {
    let gi = self
      .state
      .groups
      .iter()
      .position(|g| g.id == group_id)
      .ok_or_else(|| EngineError::UnknownGroup(group_id.to_string()))?;
    let st = self.state.groups[gi].state;
    if !matches!(st, GroupState::Active | GroupState::Queued) {
      return Err(EngineError::InvalidState(format!(
        "{group_id} 状态 {st:?} 不允许 pause"
      )));
    }
    if st == GroupState::Active {
      // Cancel queued and in-flight jobs. Pending tasks remain Pending for resume.
      if let Some(rtg) = self.state.runtime.get_mut(group_id) {
        rtg.cancel_reason = Some(CancelReason::Pause);
      }
      self.cancel_all_tokens(group_id);
      self.dequeue_group(group_id);
      self.state.groups[gi].state = GroupState::Paused;
    } else {
      self.state.groups[gi].state = GroupState::Paused;
    }
    self.emit_group_state(group_id, st, GroupState::Paused);
    self.persist_group(group_id);
    Ok(())
  }

  fn cmd_resume(&mut self, group_id: &str) -> Result<(), EngineError> {
    self.try_resume_group(group_id)
  }

  fn try_resume_group(&mut self, group_id: &str) -> Result<(), EngineError> {
    let gi = self
      .state
      .groups
      .iter()
      .position(|g| g.id == group_id)
      .ok_or_else(|| EngineError::UnknownGroup(group_id.to_string()))?;
    if self.state.groups[gi].state != GroupState::Paused {
      return Err(EngineError::InvalidState("只有 Paused 组可 resume".into()));
    }
    // Replace cancelled tokens because they cannot be reused.
    if let Some(rtg) = self.state.runtime.get_mut(group_id) {
      rtg.cancel_reason = None;
    }
    self.renew_tokens(group_id);
    // Paused task → Pending
    for t in self.state.groups[gi].tasks.iter_mut() {
      if t.state == TaskState::Paused {
        t.state = TaskState::Pending;
      }
    }
    let target = if self.active_group_count() < self.cfg.max_active_groups.max(1) {
      GroupState::Active
    } else {
      GroupState::Queued
    };
    self.state.groups[gi].state = target;
    self.emit_group_state(group_id, GroupState::Paused, target);
    if target == GroupState::Active {
      self.enqueue_group(group_id);
    }
    self.persist_group(group_id);
    Ok(())
  }

  fn cmd_cancel(&mut self, group_id: &str) -> Result<(), EngineError> {
    let gi = self
      .state
      .groups
      .iter()
      .position(|g| g.id == group_id)
      .ok_or_else(|| EngineError::UnknownGroup(group_id.to_string()))?;
    let st = self.state.groups[gi].state;
    if !matches!(
      st,
      GroupState::Active | GroupState::Queued | GroupState::Paused | GroupState::Draining
    ) {
      return Err(EngineError::InvalidState(format!("{group_id} 已终结")));
    }
    // Enter cancellation draining: stop queued and in-flight jobs, then finish as Cancelled once
    // every task reaches a terminal state.
    let rtg = self.state.runtime.get_mut(group_id).unwrap();
    rtg.cancel_reason = Some(CancelReason::Cancel);
    self.cancel_all_tokens(group_id);
    self.dequeue_group(group_id);
    // Pending → Cancelled
    let mut changed = 0;
    for t in self.state.groups[gi].tasks.iter_mut() {
      if t.state == TaskState::Pending {
        t.state = TaskState::Cancelled;
        changed += 1;
      }
    }
    if self.state.groups[gi].state != GroupState::Draining {
      let old = self.state.groups[gi].state;
      self.state.groups[gi].state = GroupState::Draining;
      self.emit_group_state(group_id, old, GroupState::Draining);
    }
    let _ = changed;
    self.persist_group(group_id);
    self.maybe_finish_group(group_id);
    Ok(())
  }

  fn cmd_retry(&mut self, group_id: &str) -> Result<(), EngineError> {
    let gi = self
      .state
      .groups
      .iter()
      .position(|g| g.id == group_id)
      .ok_or_else(|| EngineError::UnknownGroup(group_id.to_string()))?;
    if self.state.groups[gi].finish != Some(FinishKind::Failed) {
      return Err(EngineError::InvalidState(
        "只有 Finished(Failed) 组可 retry".into(),
      ));
    }
    if let Some(rtg) = self.state.runtime.get_mut(group_id) {
      rtg.cancel_reason = None;
    }
    self.renew_tokens(group_id);
    let mut revived = 0;
    for t in self.state.groups[gi].tasks.iter_mut() {
      if matches!(t.state, TaskState::Failed | TaskState::Cancelled) {
        t.state = TaskState::Pending;
        t.attempts = 0;
        t.retries_exhausted = false;
        t.error = None;
        t.verified = false;
        revived += 1;
      }
    }
    let _ = revived;
    let target = if self.active_group_count() < self.cfg.max_active_groups.max(1) {
      GroupState::Active
    } else {
      GroupState::Queued
    };
    self.state.groups[gi].state = target;
    self.state.groups[gi].finish = None;
    self.emit_group_state(group_id, GroupState::Finished, target);
    if target == GroupState::Active {
      self.enqueue_group(group_id);
    }
    self.persist_group(group_id);
    Ok(())
  }

  fn cmd_remove(&mut self, group_id: &str) -> Result<(), EngineError> {
    let index = self
      .state
      .groups
      .iter()
      .position(|group| group.id == group_id)
      .ok_or_else(|| EngineError::UnknownGroup(group_id.to_string()))?;
    if self.state.groups[index].state != GroupState::Finished {
      return Err(EngineError::InvalidState(
        "只有 Finished 组可从历史记录移除".into(),
      ));
    }
    self
      .store
      .remove_group(group_id)
      .map_err(EngineError::InvalidSubmission)?;
    self.state.groups.remove(index);
    self.state.runtime.remove(group_id);
    self.dequeue_group(group_id);
    Ok(())
  }

  fn cmd_retry_task(&mut self, group_id: &str, task_id: &str) {
    let Some(gi) = self.state.groups.iter().position(|g| g.id == group_id) else {
      return;
    };
    if self.state.groups[gi].state != GroupState::Active {
      return;
    }
    let Some(ti) = self.state.groups[gi]
      .tasks
      .iter()
      .position(|t| t.id == task_id)
    else {
      return;
    };
    if self.state.groups[gi].tasks[ti].state != TaskState::Failed {
      return;
    }
    self.state.groups[gi].tasks[ti].state = TaskState::Pending;
    self.state.groups[gi].tasks[ti].error = None;
    self.emit_task_state(group_id, task_id, TaskState::Failed, TaskState::Pending);
    self.enqueue_one(group_id, task_id);
    self.persist_group(group_id);
  }

  // ---------- Worker reports ----------

  fn handle_report(&mut self, rep: TaskReport) {
    match rep {
      TaskReport::StartRequested {
        task_id,
        start_token,
        reply,
      } => {
        let Some((gi, ti)) = self.find(&task_id) else {
          let _ = reply.send(false);
          return;
        };
        let old = self.state.groups[gi].tasks[ti].state;
        let accepted = old == TaskState::Pending
          && self.state.groups[gi].state == GroupState::Active
          && !start_token.is_cancelled();
        if accepted {
          self.state.groups[gi].tasks[ti].state = TaskState::Downloading;
          self.emit_task_state(
            &self.state.groups[gi].id,
            &task_id,
            old,
            TaskState::Downloading,
          );
          if let Some(rt) = self
            .state
            .runtime
            .get_mut(&self.state.groups[gi].id)
            .and_then(|g| g.tasks.get_mut(&task_id))
          {
            rt.queued = false;
          }
        }
        let _ = reply.send(accepted);
      }
      TaskReport::Progress {
        task_id,
        received,
        total,
      } => {
        if let Some((gi, ti)) = self.find(&task_id) {
          let t = &mut self.state.groups[gi].tasks[ti];
          t.received = received;
          t.total = total;
        }
      }
      TaskReport::Verifying { task_id } => {
        if let Some((gi, ti)) = self.find(&task_id) {
          let old = self.state.groups[gi].tasks[ti].state;
          if old == TaskState::Downloading {
            self.state.groups[gi].tasks[ti].state = TaskState::Verifying;
            self.emit_task_state(
              &self.state.groups[gi].id,
              &task_id,
              old,
              TaskState::Verifying,
            );
          }
        }
      }
      TaskReport::Outcome { task_id, outcome } => self.handle_outcome(&task_id, outcome),
    }
  }

  fn handle_outcome(&mut self, task_id: &str, outcome: TaskOutcome) {
    let Some((gi, ti)) = self.find(task_id) else {
      return;
    };
    let gid = self.state.groups[gi].id.clone();
    if self.state.groups[gi].state == GroupState::Finished {
      return; // Ignore a late report for a finished group.
    }
    let old = self.state.groups[gi].tasks[ti].state;

    // 1. Compute the target state and event data in a short borrow that ends before await or emit.
    let new_state: TaskState;
    let mut task_error: Option<TaskError> = None;
    let mut emit_verified = false;
    let mut emit_failed = false;
    match &outcome {
      TaskOutcome::Done { verified } => {
        new_state = TaskState::Done;
        emit_verified = *verified;
      }
      TaskOutcome::ChecksumFailed { expected, actual } => {
        new_state = TaskState::Failed;
        task_error = Some(TaskError::Checksum {
          expected: expected.clone(),
          actual: actual.clone(),
        });
        emit_failed = true;
      }
      TaskOutcome::Failed { error } => {
        new_state = TaskState::Failed;
        task_error = Some(error.clone());
        emit_failed = true;
      }
      TaskOutcome::Interrupted { offset } => {
        let mut persisted_offset = *offset;
        let current = self.state.groups[gi].tasks[ti].state;
        if current.is_terminal() {
          // A fail-fast claim race already marked this task Cancelled; preserve the terminal state.
          new_state = current;
        } else {
          let reason = self.state.runtime.get(&gid).and_then(|g| g.cancel_reason);
          match reason {
            Some(CancelReason::Pause) => new_state = TaskState::Paused,
            Some(CancelReason::Cancel) => {
              delete_part(&self.state.groups[gi].tasks[ti]);
              persisted_offset = 0;
              new_state = TaskState::Cancelled;
            }
            None => {
              // Draining does not cancel run_token; retain this defensive fallback.
              new_state = TaskState::Paused;
            }
          }
        }
        self.state.groups[gi].tasks[ti].offset = persisted_offset;
        self.state.groups[gi].tasks[ti].received = persisted_offset;
      }
    }
    // 2. Commit the state change.
    {
      let t = &mut self.state.groups[gi].tasks[ti];
      t.state = new_state;
      t.verified = matches!(outcome, TaskOutcome::Done { verified: true });
      if new_state == TaskState::Done {
        if t.total > 0 {
          t.received = t.total;
          t.offset = t.total;
        }
        t.error = None;
      }
      if let Some(e) = &task_error {
        t.error = Some(e.clone());
      }
    }
    // 3. Emit events after releasing all borrows.
    self.emit_task_state(&gid, task_id, old, new_state);
    if emit_verified {
      self.emit(EngineEvent::TaskVerified {
        group_id: gid.clone(),
        task_id: task_id.into(),
      });
    }
    if emit_failed {
      if let Some(e) = &task_error {
        self.emit(EngineEvent::TaskFailed {
          group_id: gid.clone(),
          task_id: task_id.into(),
          error: e.clone(),
        });
      }
    }
    // 4. Decide whether to retry automatically or fail fast.
    let (attempts, transient, group_active) = {
      let t = &self.state.groups[gi].tasks[ti];
      (
        t.attempts,
        t.error.as_ref().map(|e| e.is_transient()).unwrap_or(false),
        self.state.groups[gi].state == GroupState::Active,
      )
    };
    let schedule_retry = new_state == TaskState::Failed
      && group_active
      && attempts < self.cfg.max_retries
      && transient;
    if schedule_retry {
      self.state.groups[gi].tasks[ti].attempts = attempts + 1;
    } else if new_state == TaskState::Failed {
      self.state.groups[gi].tasks[ti].retries_exhausted = true;
    }
    self.persist_group(&gid);

    if schedule_retry {
      let attempts = self.state.groups[gi].tasks[ti].attempts;
      let delay = self.cfg.retry_backoff * 2u32.pow(attempts.min(6));
      let tx = self.self_tx.clone();
      let (gid2, tid2) = (gid.clone(), task_id.to_string());
      tokio::spawn(async move {
        tokio::time::sleep(delay).await;
        let _ = tx
          .send(Command::RetryTask {
            group_id: gid2,
            task_id: tid2,
          })
          .await;
      });
    } else if self.state.groups[gi].tasks[ti].state == TaskState::Failed
      && self.state.groups[gi].tasks[ti].retries_exhausted
      && self.state.groups[gi].state != GroupState::Draining
    {
      self.fail_group(&gid, task_id);
      return;
    }
    self.maybe_finish_group(&gid);
  }

  /// Fails a group fast by entering Draining, stopping queued jobs, cancelling Pending tasks, and
  /// allowing in-flight jobs to drain.
  fn fail_group(&mut self, group_id: &str, _failed_task_id: &str) {
    let Some(gi) = self.state.groups.iter().position(|g| g.id == group_id) else {
      return;
    };
    if self.state.groups[gi].state == GroupState::Finished {
      return;
    }
    // Cancel only start_token so queued jobs are dropped on claim while in-flight jobs drain.
    self.cancel_start_tokens(group_id);
    self.dequeue_group(group_id);
    let old = self.state.groups[gi].state;
    if old != GroupState::Draining {
      self.state.groups[gi].state = GroupState::Draining;
      self.emit_group_state(group_id, old, GroupState::Draining);
    }
    // Change Pending tasks to Cancelled without per-task events to avoid an event storm; the
    // frontend observes the batch through ticks and snapshots.
    for t in self.state.groups[gi].tasks.iter_mut() {
      if t.state == TaskState::Pending {
        t.state = TaskState::Cancelled;
      }
    }
    self.persist_group(group_id);
    self.maybe_finish_group(group_id);
  }

  fn maybe_finish_group(&mut self, group_id: &str) {
    let Some(gi) = self.state.groups.iter().position(|g| g.id == group_id) else {
      return;
    };
    let st = self.state.groups[gi].state;
    match st {
      GroupState::Active => {
        // An Active group completes naturally only when every task is Done. Failed or Cancelled
        // tasks are either awaiting an automatic retry back to Pending or moving the group into
        // Draining through fail_group, so do not finish the group here.
        if self.state.groups[gi]
          .tasks
          .iter()
          .any(|t| t.state != TaskState::Done)
        {
          return;
        }
      }
      GroupState::Draining => {
        if !self.state.groups[gi].all_terminal() {
          return;
        }
      }
      _ => return,
    }
    let finish = match st {
      GroupState::Draining => match self
        .state
        .runtime
        .get(group_id)
        .and_then(|g| g.cancel_reason)
      {
        Some(CancelReason::Cancel) => FinishKind::Cancelled,
        _ => FinishKind::Failed,
      },
      _ => FinishKind::Completed,
    };
    let old = self.state.groups[gi].state;
    self.state.groups[gi].state = GroupState::Finished;
    self.state.groups[gi].finish = Some(finish);
    self.emit_group_state(group_id, old, GroupState::Finished);
    let (failed, summary) = {
      let g = &self.state.groups[gi];
      (
        g.tasks
          .iter()
          .filter(|t| t.state == TaskState::Failed)
          .map(|t| t.id.clone())
          .collect::<Vec<_>>(),
        g.stats(),
      )
    };
    self.emit(EngineEvent::GroupFinished {
      group_id: group_id.into(),
      finish,
      failed_tasks: failed,
      summary,
    });
    self.persist_group(group_id);
  }

  // ---------- Scheduling ----------

  fn dispatch_step(&mut self) {
    // 1. Activate queued groups while capacity is available.
    loop {
      let active = self
        .state
        .groups
        .iter()
        .filter(|g| g.state == GroupState::Active)
        .count();
      if active >= self.cfg.max_active_groups.max(1) {
        break;
      }
      let Some(gi) = self
        .state
        .groups
        .iter()
        .position(|g| g.state == GroupState::Queued)
      else {
        break;
      };
      let gid = self.state.groups[gi].id.clone();
      let old = self.state.groups[gi].state;
      self.state.groups[gi].state = GroupState::Active;
      self.emit_group_state(&gid, old, GroupState::Active);
      self.enqueue_group(&gid);
    }
    // 2. Dispatch the ready queue.
    while let Some(tid) = self.state.ready.pop_front() {
      let Some((gi, ti)) = self.find(&tid) else {
        continue;
      };
      let gid = self.state.groups[gi].id.clone();
      let Some(rt) = self
        .state
        .runtime
        .get_mut(&gid)
        .and_then(|g| g.tasks.get_mut(&tid))
      else {
        continue;
      };
      if rt.queued {
        continue;
      }
      let g_active = self.state.groups[gi].state == GroupState::Active;
      let t_pending = self.state.groups[gi].tasks[ti].state == TaskState::Pending;
      if !g_active || !t_pending {
        continue;
      }
      let (start, run) = (rt.start_token.clone(), rt.run_token.clone());
      let t = &self.state.groups[gi].tasks[ti];
      let ctx = ExecContext {
        task_id: tid.clone(),
        group_id: gid.clone(),
        name: t.name.clone(),
        executor: t.executor.clone(),
        spec: t.spec.clone(),
        dest: t.dest.clone(),
        sha1: t.sha1.clone(),
        sha256: t.sha256.clone(),
        resume_offset: t.offset,
        start_token: start,
        run_token: run,
        report: self.report_tx.clone(),
      };
      if self.ready_tx.try_send(Job { ctx }).is_err() {
        // Return the task to the front when the channel is full and retry on the next tick.
        self.state.ready.push_front(tid);
        break;
      }
      // Mark a dispatched task as queued until the worker reports Started.
      if let Some(rt) = self
        .state
        .runtime
        .get_mut(&gid)
        .and_then(|g| g.tasks.get_mut(&tid))
      {
        rt.queued = true;
      }
    }
  }

  fn enqueue_group(&mut self, group_id: &str) {
    let Some(gi) = self.state.groups.iter().position(|g| g.id == group_id) else {
      return;
    };
    let tids: Vec<String> = self.state.groups[gi]
      .tasks
      .iter()
      .filter(|t| t.state == TaskState::Pending)
      .map(|t| t.id.clone())
      .collect();
    for tid in tids {
      self.enqueue_one(group_id, &tid);
    }
  }

  fn enqueue_one(&mut self, group_id: &str, task_id: &str) {
    // Do not enqueue tasks already sent to a worker channel (`queued=true`) or already in the ready
    // queue. The flag becomes true only after try_send succeeds, so ready-queue entries remain false.
    if self.state.ready.contains(&task_id.to_string()) {
      return;
    }
    if let Some(rt) = self
      .state
      .runtime
      .get_mut(group_id)
      .and_then(|g| g.tasks.get_mut(task_id))
    {
      if !rt.queued {
        self.state.ready.push_back(task_id.to_string());
      }
    }
  }

  /// Removes all queued tasks for a group from the ready queue and clears their `queued` flags so
  /// they may be enqueued again.
  fn dequeue_group(&mut self, group_id: &str) {
    let mut keep = VecDeque::new();
    while let Some(tid) = self.state.ready.pop_front() {
      let belongs = self
        .find(&tid)
        .map(|(gi, _)| self.state.groups[gi].id == group_id)
        .unwrap_or(false);
      if belongs {
        if let Some(rt) = self
          .state
          .runtime
          .get_mut(group_id)
          .and_then(|g| g.tasks.get_mut(&tid))
        {
          rt.queued = false;
        }
      } else {
        keep.push_back(tid);
      }
    }
    self.state.ready = keep;
  }

  /// Cancels only start_token so queued jobs are dropped on claim while in-flight jobs drain.
  /// Used for fail-fast and Draining.
  fn cancel_start_tokens(&mut self, group_id: &str) {
    let Some(rtg) = self.state.runtime.get_mut(group_id) else {
      return;
    };
    for rt in rtg.tasks.values_mut() {
      rt.start_token.cancel();
    }
  }

  /// Cancels both start and run tokens for pause and cancel, interrupting in-flight jobs immediately.
  fn cancel_all_tokens(&mut self, group_id: &str) {
    let Some(rtg) = self.state.runtime.get_mut(group_id) else {
      return;
    };
    for rt in rtg.tasks.values_mut() {
      rt.start_token.cancel();
      rt.run_token.cancel();
    }
  }

  /// Replaces tokens invalidated by resume or retry.
  fn renew_tokens(&mut self, group_id: &str) {
    let Some(rtg) = self.state.runtime.get_mut(group_id) else {
      return;
    };
    for rt in rtg.tasks.values_mut() {
      rt.start_token = CancellationToken::new();
      rt.run_token = CancellationToken::new();
      rt.queued = false;
    }
  }

  fn try_activate_next_group(&mut self) {
    // Match dispatch_step activation and try immediately after submission.
    if self.active_group_count() < self.cfg.max_active_groups.max(1) {
      if let Some(gi) = self
        .state
        .groups
        .iter()
        .position(|g| g.state == GroupState::Queued)
      {
        let gid = self.state.groups[gi].id.clone();
        let old = self.state.groups[gi].state;
        self.state.groups[gi].state = GroupState::Active;
        self.emit_group_state(&gid, old, GroupState::Active);
        self.enqueue_group(&gid);
      }
    }
  }

  fn active_group_count(&self) -> usize {
    self
      .state
      .groups
      .iter()
      .filter(|g| g.state == GroupState::Active)
      .count()
  }

  // ---------- Progress events ----------

  fn emit_progress(&mut self) {
    let now = Instant::now();
    let mut out: Vec<Progress> = Vec::new();
    for gi in 0..self.state.groups.len() {
      let gid = self.state.groups[gi].id.clone();
      let mut items: Vec<(String, TaskState, u64, u64, f64, Option<f64>)> = Vec::new();
      // Collect first to avoid conflicting borrows.
      for t in &self.state.groups[gi].tasks {
        // Report only active tasks. Paused and Pending are static and represented by state events
        // and snapshots; reporting them would keep refreshing the DOM every 200 ms after a pause.
        if !matches!(t.state, TaskState::Downloading | TaskState::Verifying) {
          continue;
        }
        items.push((t.id.clone(), t.state, t.received, t.total, 0.0, None));
      }
      for (tid, st, received, total, _, _) in items {
        let speed = if st == TaskState::Downloading {
          let mut speed = 0.0;
          if let Some(rt) = self
            .state
            .runtime
            .get_mut(&gid)
            .and_then(|g| g.tasks.get_mut(&tid))
          {
            let dt = now.duration_since(rt.prev_at.unwrap_or(now)).as_secs_f64();
            if dt > 0.05 {
              let inst = (received.saturating_sub(rt.prev_received)) as f64 / dt;
              rt.speed_ema = if rt.speed_ema <= 0.0 {
                inst
              } else {
                0.7 * inst + 0.3 * rt.speed_ema
              };
              speed = rt.speed_ema;
            } else {
              speed = rt.speed_ema;
            }
            rt.prev_received = received;
            rt.prev_at = Some(now);
          }
          speed
        } else {
          0.0
        };
        let eta = if speed > 1.0 && total > received {
          Some(((total - received) as f64 / speed).min(86400.0))
        } else {
          None
        };
        out.push(Progress {
          task_id: tid,
          group_id: gid.clone(),
          state: st,
          received,
          total,
          speed_bps: speed,
          eta_secs: eta,
        });
      }
    }
    if !out.is_empty() {
      self.emit(EngineEvent::Tick(out));
    }
  }

  // ---------- Event and persistence helpers ----------

  fn emit_group_state(&self, group_id: &str, old: GroupState, new: GroupState) {
    if old != new {
      self.emit(EngineEvent::GroupStateChanged {
        group_id: group_id.into(),
        old,
        new,
      });
    }
  }

  fn emit_task_state(&self, group_id: &str, task_id: &str, old: TaskState, new: TaskState) {
    if old != new {
      self.emit(EngineEvent::TaskStateChanged {
        group_id: group_id.into(),
        task_id: task_id.into(),
        old,
        new,
      });
    }
  }

  fn persist_group(&self, group_id: &str) {
    if let Some(g) = self.state.groups.iter().find(|g| g.id == group_id) {
      if let Err(e) = self.store.save_group(g) {
        tracing::warn!("persist group {group_id} failed: {e}");
      }
    }
  }
}

fn delete_part(task: &Task) {
  if let Some(dest) = &task.dest {
    let mut s = dest.as_os_str().to_owned();
    s.push(".part");
    let _ = std::fs::remove_file(std::path::PathBuf::from(s));
  }
}
