//! EngineActor is the sole event loop and owner of mutable engine state.
//!
//! Inputs and timers:
//! - frontend commands;
//! - worker reports;
//! - dispatch ticks that activate groups and enqueue ready tasks;
//! - emit ticks that batch progress into one Tick event.
//!
//! Invariants:
//! - only the actor emits events through EventSink;
//! - workers report through TaskReport and never mutate engine state;
//! - start_token stops queued work; run_token interrupts active work;
//! - terminal failures drain the group: stop scheduling and let active work finish.

use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;
use std::time::{Duration, Instant};

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
use crate::persistence::Persistence;
use crate::storage::StateStore;
use crate::{ExecContext, GroupSummary, Progress, TaskOutcome, TaskReport};

/// Frontend handle that owns only the command sender.
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

  /// Return after all accepted executions have exited and their final offsets are persisted.
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

  /// Wait for an in-progress pause before renewing tokens and scheduling the group.
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

  pub async fn acknowledge_completion(&self, group_id: String) -> Result<(), EngineError> {
    let (tx, rx) = oneshot::channel();
    self
      .send(Command::AcknowledgeCompletion {
        group_id,
        reply: tx,
      })
      .await?;
    rx.await.map_err(|_| EngineError::ChannelClosed)?
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

  /// Build the handle before starting dispatch so the host can register its state first.
  pub fn build(self) -> (Engine, impl Future<Output = ()> + Send + 'static) {
    let (cmd_tx, cmd_rx) = mpsc::channel(256);
    let (report_tx, report_rx) = mpsc::channel(1024);
    let executors: Arc<dyn ExecutorRegistry> = Arc::new(self.executors);
    let (worker_handles, ready_tx) = spawn_worker_pool(executors.clone(), self.cfg.concurrency);
    let persistence = Persistence::new(self.store.clone());

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
      persistence,
      dirty_groups: HashSet::new(),
      pending_finishes: HashSet::new(),
      completed_progress: HashMap::new(),
      pause_handoffs: HashMap::new(),
    };
    // Reconcile persisted groups after restart, including auto-resume eligibility.
    if let Ok(mut groups) = actor.store.load_all() {
      crate::storage::reconcile_after_restart(&mut groups);
      actor.seq = groups
        .iter()
        .flat_map(|g| std::iter::once(&g.id).chain(g.tasks.iter().map(|t| &t.id)))
        .filter_map(|id| id.get(1..)?.parse::<u64>().ok())
        .max()
        .unwrap_or(0);
      for g in groups {
        // Keep unfinished work, retryable failures, and pending completion actions.
        if g.state == GroupState::Finished
          && g.finish != Some(FinishKind::Failed)
          && !g.completion_pending
        {
          continue;
        }
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
    (Engine { tx: cmd_tx }, actor.run())
  }
}

#[derive(Default)]
struct EngineState {
  groups: Vec<TaskGroup>,
  runtime: HashMap<String, RuntimeGroup>,
  /// Global ready queue in task submission order.
  ready: VecDeque<String>,
  ready_ids: HashSet<String>,
  task_index: HashMap<String, (usize, usize)>,
}

#[derive(Default)]
struct PauseHandoff {
  pauses: Vec<Reply<()>>,
  resumes: Vec<Reply<()>>,
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
  /// Sender used for the actor's own delayed retry commands.
  self_tx: mpsc::Sender<Command>,
  state: EngineState,
  seq: u64,
  _worker_handles: Vec<tokio::task::JoinHandle<()>>,
  persistence: Persistence,
  dirty_groups: HashSet<String>,
  pending_finishes: HashSet<String>,
  completed_progress: HashMap<String, Progress>,
  pause_handoffs: HashMap<String, PauseHandoff>,
}

impl EngineActor {
  async fn run(mut self) {
    let mut dispatch = interval(self.cfg.dispatch_interval);
    let mut emit = interval(self.cfg.emit_interval);
    let mut persist = interval(Duration::from_millis(200));
    persist.set_missed_tick_behavior(MissedTickBehavior::Skip);
    dispatch.set_missed_tick_behavior(MissedTickBehavior::Skip);
    emit.set_missed_tick_behavior(MissedTickBehavior::Skip);
    loop {
      tokio::select! {
          cmd = self.cmd_rx.recv() => match cmd {
              Some(c) => self.handle_cmd(c).await,
              None => break,
          },
          rep = self.report_rx.recv() => match rep {
              Some(r) => self.handle_report(r).await,
              None => break,
          },
          _ = dispatch.tick() => self.dispatch_step().await,
          _ = emit.tick() => self.emit_progress(),
          _ = persist.tick() => {
            self.flush_persistence();
            let pending: Vec<_> = self.pending_finishes.iter().cloned().collect();
            for id in pending {
              self.maybe_finish_group(&id).await;
            }
          },
      }
    }
    tracing::info!("engine actor stopped");
  }

  // ---------- Queries and helpers ----------

  fn find(&self, task_id: &str) -> Option<(usize, usize)> {
    self.state.task_index.get(task_id).copied()
  }

  fn emit(&self, ev: EngineEvent) {
    self.sink.emit(&ev);
  }

  fn init_runtime(&mut self, group_id: &str) {
    let mut rtg = RuntimeGroup::new();
    if let Some(gi) = self.state.groups.iter().position(|g| g.id == group_id) {
      for (ti, t) in self.state.groups[gi].tasks.iter().enumerate() {
        self.state.task_index.insert(t.id.clone(), (gi, ti));
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
    self.recount_runtime(group_id);
  }

  // Bulk changes are rare; ordinary outcomes update these counters in constant time.
  fn recount_runtime(&mut self, group_id: &str) {
    let Some(group) = self.state.groups.iter().find(|g| g.id == group_id) else {
      return;
    };
    let runtime = self.state.runtime.get_mut(group_id).unwrap();
    runtime.remaining.clear();
    runtime.nonterminal = 0;
    for task in &group.tasks {
      if task.state != TaskState::Done {
        let stage = self
          .executors
          .get(&task.executor)
          .map_or(0, |ex| ex.postprocess_order());
        *runtime.remaining.entry(stage).or_default() += 1;
      }
      runtime.nonterminal += usize::from(!task.state.is_terminal());
    }
  }

  fn set_task_state(&mut self, gi: usize, ti: usize, state: TaskState) -> bool {
    let task = &mut self.state.groups[gi].tasks[ti];
    let old = task.state;
    task.state = state;
    let runtime = self.state.runtime.get_mut(&task.group_id).unwrap();
    if old.is_terminal() && !state.is_terminal() {
      runtime.nonterminal += 1;
    }
    if !old.is_terminal() && state.is_terminal() {
      runtime.nonterminal -= 1;
    }
    let stage = self
      .executors
      .get(&task.executor)
      .map_or(0, |ex| ex.postprocess_order());
    if old == TaskState::Done && state != TaskState::Done {
      *runtime.remaining.entry(stage).or_default() += 1;
    } else if old != TaskState::Done && state == TaskState::Done {
      let count = runtime.remaining.get_mut(&stage).unwrap();
      *count -= 1;
      if *count == 0 {
        runtime.remaining.remove(&stage);
        return true;
      }
    }
    false
  }

  // ---------- Command handling ----------

  async fn handle_cmd(&mut self, cmd: Command) {
    match cmd {
      Command::SubmitGroup(sg, reply) => self.cmd_submit(sg, reply).await,
      Command::Pause { group_id, reply } => match self.cmd_pause(&group_id) {
        Ok(()) => {
          self
            .pause_handoffs
            .entry(group_id.clone())
            .or_default()
            .pauses
            .push(reply);
          self.complete_pause(&group_id).await;
        }
        Err(error) => {
          let _ = reply.send(Err(error));
        }
      },
      Command::Resume { group_id, reply } => {
        let stopping = self.state.groups.iter().any(|group| {
          group.id == group_id
            && group.state == GroupState::Paused
            && !self.state.runtime[&group_id].running.is_empty()
        });
        if stopping {
          self
            .pause_handoffs
            .entry(group_id)
            .or_default()
            .resumes
            .push(reply);
        } else {
          let r = self.cmd_resume(&group_id).await;
          let _ = reply.send(r);
        }
      }
      Command::Cancel { group_id, reply } => {
        let r = self.cmd_cancel(&group_id).await;
        self.complete_pause(&group_id).await;
        let _ = reply.send(r);
      }
      Command::Retry { group_id, reply } => {
        let r = self.cmd_retry(&group_id).await;
        let _ = reply.send(r);
      }
      Command::Remove { group_id, reply } => {
        let r = self.cmd_remove(&group_id).await;
        let _ = reply.send(r);
      }
      Command::AcknowledgeCompletion { group_id, reply } => {
        let r = self.cmd_acknowledge_completion(&group_id).await;
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
            parent_group_id: g.parent_group_id.clone(),
            state: g.state,
            finish: g.finish,
            completion_pending: g.completion_pending,
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
          .ok_or(EngineError::UnknownGroup { group_id });
        let _ = reply.send(r);
      }
    }
  }

  async fn cmd_submit(&mut self, sg: crate::SubmitGroup, reply: Reply<String>) {
    if sg.tasks.is_empty() {
      let _ = reply.send(Err(EngineError::EmptyGroup));
      return;
    }
    if let Some(parent_id) = &sg.parent_group_id
      && !self.state.groups.iter().any(|group| &group.id == parent_id)
    {
      let _ = reply.send(Err(EngineError::UnknownGroup {
        group_id: parent_id.clone(),
      }));
      return;
    }
    // Reject tasks with unregistered executors before persisting the group.
    for t in &sg.tasks {
      if self.executors.get(&t.executor).is_none() {
        let _ = reply.send(Err(EngineError::UnknownExecutor {
          executor: t.executor.clone(),
        }));
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
      parent_group_id: sg.parent_group_id,
      auto_resume: sg.auto_resume,
      state: GroupState::Queued,
      finish: None,
      completion_pending: false,
      tasks,
    };
    if let Err(error) = self.persistence.save(group.clone()).await {
      let _ = reply.send(Err(error));
      return;
    }
    self.state.groups.push(group);
    self.init_runtime(&gid);
    self.emit(EngineEvent::GroupSubmitted {
      group_id: gid.clone(),
    });
    // Activate immediately if a group slot is available.
    self.try_activate_next_group();
    let _ = reply.send(Ok(gid));
  }

  fn cmd_pause(&mut self, group_id: &str) -> Result<(), EngineError> {
    let gi = self
      .state
      .groups
      .iter()
      .position(|g| g.id == group_id)
      .ok_or_else(|| EngineError::UnknownGroup {
        group_id: group_id.to_string(),
      })?;
    let st = self.state.groups[gi].state;
    if !matches!(st, GroupState::Active | GroupState::Queued) {
      return Err(EngineError::InvalidState {
        group_id: group_id.to_string(),
        state: st,
      });
    }
    if st == GroupState::Active {
      // Invalidate queued and active work; pending tasks remain resumable.
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
    Ok(())
  }

  async fn complete_pause(&mut self, group_id: &str) {
    if !self.pause_handoffs.contains_key(group_id) {
      return;
    }
    let state = self
      .state
      .groups
      .iter()
      .find(|group| group.id == group_id)
      .unwrap()
      .state;
    if state == GroupState::Paused && !self.state.runtime[group_id].running.is_empty() {
      return;
    }
    let handoff = self.pause_handoffs.remove(group_id).unwrap();
    let result = if state == GroupState::Paused {
      // All old executors have returned; offsets are final and file handles are released.
      self.persist_group(group_id).await
    } else {
      Err(EngineError::InvalidState {
        group_id: group_id.into(),
        state,
      })
    };
    for reply in handoff.pauses {
      let _ = reply.send(result.clone());
    }
    if !handoff.resumes.is_empty() {
      let resumed = match result {
        Ok(()) => self.try_resume_group(group_id).await,
        Err(error) => Err(error),
      };
      for reply in handoff.resumes {
        let _ = reply.send(resumed.clone());
      }
    }
  }

  async fn cmd_resume(&mut self, group_id: &str) -> Result<(), EngineError> {
    self.try_resume_group(group_id).await
  }

  async fn try_resume_group(&mut self, group_id: &str) -> Result<(), EngineError> {
    let gi = self
      .state
      .groups
      .iter()
      .position(|g| g.id == group_id)
      .ok_or_else(|| EngineError::UnknownGroup {
        group_id: group_id.to_string(),
      })?;
    if self.state.groups[gi].state != GroupState::Paused {
      return Err(EngineError::InvalidState {
        group_id: group_id.to_string(),
        state: self.state.groups[gi].state,
      });
    }
    // Cancelled tokens cannot be reused after resume.
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
    self.persist_group(group_id).await?;
    self.maybe_finish_group(group_id).await;
    Ok(())
  }

  async fn cmd_cancel(&mut self, group_id: &str) -> Result<(), EngineError> {
    let gi = self
      .state
      .groups
      .iter()
      .position(|g| g.id == group_id)
      .ok_or_else(|| EngineError::UnknownGroup {
        group_id: group_id.to_string(),
      })?;
    let st = self.state.groups[gi].state;
    if !matches!(
      st,
      GroupState::Active | GroupState::Queued | GroupState::Paused | GroupState::Draining
    ) {
      return Err(EngineError::InvalidState {
        group_id: group_id.to_string(),
        state: st,
      });
    }
    // Cancel queued and active work, then wait for all tasks to become terminal.
    let rtg = self.state.runtime.get_mut(group_id).unwrap();
    rtg.cancel_reason = Some(CancelReason::Cancel);
    self.cancel_all_tokens(group_id);
    self.dequeue_group(group_id);
    // Tasks without a running worker cannot report cancellation themselves.
    for t in self.state.groups[gi].tasks.iter_mut() {
      if matches!(t.state, TaskState::Pending | TaskState::Paused) {
        delete_part(t);
        t.state = TaskState::Cancelled;
        t.offset = 0;
        t.received = 0;
      }
    }
    if self.state.groups[gi].state != GroupState::Draining {
      let old = self.state.groups[gi].state;
      self.state.groups[gi].state = GroupState::Draining;
      self.emit_group_state(group_id, old, GroupState::Draining);
    }
    self.recount_runtime(group_id);
    self.persist_group(group_id).await?;
    self.maybe_finish_group(group_id).await;
    Ok(())
  }

  async fn cmd_retry(&mut self, group_id: &str) -> Result<(), EngineError> {
    let gi = self
      .state
      .groups
      .iter()
      .position(|g| g.id == group_id)
      .ok_or_else(|| EngineError::UnknownGroup {
        group_id: group_id.to_string(),
      })?;
    if self.state.groups[gi].finish != Some(FinishKind::Failed) {
      return Err(EngineError::InvalidState {
        group_id: group_id.to_string(),
        state: self.state.groups[gi].state,
      });
    }
    self
      .completed_progress
      .retain(|_, progress| progress.group_id != group_id);
    let corrupt_paths: Vec<_> = self.state.groups[gi]
      .tasks
      .iter()
      .filter_map(|task| match &task.error {
        Some(TaskError::CorruptFiles { paths }) => Some(paths.as_slice()),
        _ => None,
      })
      .flatten()
      .cloned()
      .collect();
    if !corrupt_paths.is_empty() {
      let mut first_postprocess = false;
      for task in self.state.groups[gi].tasks.iter_mut() {
        if task.executor == "download"
          && task
            .dest
            .as_ref()
            .is_some_and(|dest| corrupt_paths.contains(dest))
        {
          task.state = TaskState::Pending;
          task.error = None;
          task.verified = false;
          task.offset = 0;
          task.received = 0;
          first_postprocess = true;
        }
      }
      if first_postprocess {
        for task in self.state.groups[gi].tasks.iter_mut() {
          if self
            .executors
            .get(&task.executor)
            .is_some_and(|ex| ex.postprocess_order() > 0)
          {
            task.state = TaskState::Pending;
            task.error = None;
            task.verified = false;
          }
        }
      }
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
    self.recount_runtime(group_id);
    self.emit_group_state(group_id, GroupState::Finished, target);
    if target == GroupState::Active {
      self.enqueue_group(group_id);
    }
    self.persist_group(group_id).await?;
    Ok(())
  }

  async fn cmd_remove(&mut self, group_id: &str) -> Result<(), EngineError> {
    let index = self
      .state
      .groups
      .iter()
      .position(|group| group.id == group_id)
      .ok_or_else(|| EngineError::UnknownGroup {
        group_id: group_id.to_string(),
      })?;
    if self.state.groups[index].state != GroupState::Finished {
      return Err(EngineError::InvalidState {
        group_id: group_id.to_string(),
        state: self.state.groups[index].state,
      });
    }
    self.persistence.remove(group_id).await?;
    self.dequeue_group(group_id);
    self.state.groups.remove(index);
    self.state.runtime.remove(group_id);
    self.dirty_groups.remove(group_id);
    self.pending_finishes.remove(group_id);
    self
      .completed_progress
      .retain(|_, progress| progress.group_id != group_id);
    self.state.task_index.clear();
    for (gi, group) in self.state.groups.iter().enumerate() {
      for (ti, task) in group.tasks.iter().enumerate() {
        self.state.task_index.insert(task.id.clone(), (gi, ti));
      }
    }
    Ok(())
  }

  async fn cmd_acknowledge_completion(&mut self, group_id: &str) -> Result<(), EngineError> {
    let group = self
      .state
      .groups
      .iter_mut()
      .find(|g| g.id == group_id)
      .ok_or_else(|| EngineError::UnknownGroup {
        group_id: group_id.to_string(),
      })?;
    if group.state != GroupState::Finished || group.finish != Some(FinishKind::Completed) {
      return Err(EngineError::InvalidState {
        group_id: group_id.to_string(),
        state: group.state,
      });
    }
    let mut acknowledged = group.clone();
    acknowledged.completion_pending = false;
    self.persistence.save(acknowledged.clone()).await?;
    *group = acknowledged;
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
    self.set_task_state(gi, ti, TaskState::Pending);
    self.state.groups[gi].tasks[ti].error = None;
    self.emit_task_state(group_id, task_id, TaskState::Failed, TaskState::Pending);
    self.enqueue_one(group_id, task_id);
    self.dirty_groups.insert(group_id.into());
  }

  // ---------- Worker reports ----------

  async fn handle_report(&mut self, rep: TaskReport) {
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
          && !start_token.is_cancelled()
          && !self.state.runtime[&self.state.groups[gi].id]
            .running
            .contains(&task_id);
        if accepted {
          self
            .state
            .runtime
            .get_mut(&self.state.groups[gi].id)
            .unwrap()
            .running
            .insert(task_id.clone());
          self.completed_progress.remove(&task_id);
          self.set_task_state(gi, ti, TaskState::Downloading);
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
            rt.speed_ema = 0.0;
            rt.prev_received = 0;
            rt.prev_at = None;
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
            self.set_task_state(gi, ti, TaskState::Verifying);
            self.emit_task_state(
              &self.state.groups[gi].id,
              &task_id,
              old,
              TaskState::Verifying,
            );
          }
        }
      }
      TaskReport::Outcome { task_id, outcome } => self.handle_outcome(&task_id, outcome).await,
      TaskReport::WorkerStopped { task_id } => {
        let Some((gi, ti)) = self.find(&task_id) else {
          return;
        };
        let group_id = self.state.groups[gi].id.clone();
        if !self
          .state
          .runtime
          .get_mut(&group_id)
          .unwrap()
          .running
          .remove(&task_id)
        {
          return;
        }
        // A delayed retry may already be pending, but must not overlap its old executor.
        if self.state.groups[gi].state == GroupState::Active
          && self.state.groups[gi].tasks[ti].state == TaskState::Pending
        {
          self.enqueue_one(&group_id, &task_id);
        }
        self.complete_pause(&group_id).await;
        self.maybe_finish_group(&group_id).await;
      }
    }
  }

  async fn handle_outcome(&mut self, task_id: &str, outcome: TaskOutcome) {
    let Some((gi, ti)) = self.find(task_id) else {
      return;
    };
    let gid = self.state.groups[gi].id.clone();
    if self.state.groups[gi].state == GroupState::Finished {
      return; // Ignore a late report after the group has finished.
    }
    let old = self.state.groups[gi].tasks[ti].state;

    // Derive the next state and event data before mutating the task.
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
          // Fail-fast may already have cancelled this task during the start handshake.
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
              new_state = TaskState::Failed;
              task_error = Some(TaskError::Other {
                details: "executor interrupted without a cancellation request".into(),
              });
              emit_failed = true;
            }
          }
        }
        self.state.groups[gi].tasks[ti].offset = persisted_offset;
        self.state.groups[gi].tasks[ti].received = persisted_offset;
      }
    }
    // Commit the task state.
    let stage_finished = self.set_task_state(gi, ti, new_state);
    {
      let t = &mut self.state.groups[gi].tasks[ti];
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
    // Small downloads may finish between periodic ticks. Send their final byte
    // counts so the frontend can include them in group throughput samples.
    let task = &self.state.groups[gi].tasks[ti];
    if new_state == TaskState::Done && task.executor == "download" {
      self.completed_progress.insert(
        task_id.into(),
        Progress {
          task_id: task_id.into(),
          group_id: gid.clone(),
          state: new_state,
          received: task.received,
          total: task.total,
          speed_bps: 0.0,
          eta_secs: None,
        },
      );
    }
    // Emit state and verification events.
    self.emit_task_state(&gid, task_id, old, new_state);
    if emit_verified {
      self.emit(EngineEvent::TaskVerified {
        group_id: gid.clone(),
        task_id: task_id.into(),
      });
    }
    let group_active = self.state.groups[gi].state == GroupState::Active;
    let (attempts, retry_limit, transient, can_switch_source) = {
      let t = &self.state.groups[gi].tasks[ti];
      let source_count = if new_state == TaskState::Failed {
        download_sources(t).len()
      } else {
        0
      };
      (
        t.attempts,
        (self.cfg.max_retries as usize).max(source_count.saturating_sub(1)),
        t.error.as_ref().is_some_and(TaskError::is_transient),
        source_count > 1
          && matches!(
            t.error,
            Some(
              TaskError::Network { .. }
                | TaskError::Http { .. }
                | TaskError::Checksum { .. }
                | TaskError::InvalidContentRange
                | TaskError::ResumeOffsetMismatch { .. }
            )
          ),
      )
    };
    // Include source switches in the retry budget, extending it to try every source once.
    let mut schedule_retry = new_state == TaskState::Failed
      && group_active
      && (attempts as usize) < retry_limit
      && (transient || can_switch_source);
    let switched_source = if schedule_retry && can_switch_source {
      match advance_download_source(&mut self.state.groups[gi].tasks[ti]) {
        Ok(switched) => switched,
        Err(error) => {
          self.state.groups[gi].tasks[ti].error = Some(error.clone());
          task_error = Some(error);
          schedule_retry = false;
          false
        }
      }
    } else {
      false
    };
    if switched_source
      && let Some(runtime) = self
        .state
        .runtime
        .get_mut(&gid)
        .and_then(|group| group.tasks.get_mut(task_id))
    {
      runtime.speed_ema = 0.0;
      runtime.prev_received = 0;
      runtime.prev_at = None;
    }
    if schedule_retry {
      self.state.groups[gi].tasks[ti].attempts = attempts + 1;
    } else if !schedule_retry && new_state == TaskState::Failed {
      self.state.groups[gi].tasks[ti].retries_exhausted = true;
    }
    // Keep intermediate failures in task state, but emit TaskFailed only when no retry remains.
    if emit_failed
      && !schedule_retry
      && let Some(e) = &task_error
    {
      self.emit(EngineEvent::TaskFailed {
        group_id: gid.clone(),
        task_id: task_id.into(),
        error: e.clone(),
      });
    }
    self.dirty_groups.insert(gid.clone());
    if matches!(outcome, TaskOutcome::Interrupted { .. })
      && let Err(error) = self.persist_group(&gid).await
    {
      tracing::warn!("persist interrupted group {gid} failed: {error}");
    }

    if stage_finished && group_active {
      self.enqueue_group(&gid);
    }

    if schedule_retry {
      let attempts = self.state.groups[gi].tasks[ti].attempts;
      // The first retry waits one base interval; later delays double up to a 64x cap.
      let delay = self.cfg.retry_backoff * 2u32.pow(attempts.saturating_sub(1).min(6));
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
      self.fail_group(&gid, task_id).await;
      return;
    }
    self.maybe_finish_group(&gid).await;
  }

  /// Enter Draining: stop queued work, cancel pending tasks, and let active tasks finish.
  async fn fail_group(&mut self, group_id: &str, _failed_task_id: &str) {
    let Some(gi) = self.state.groups.iter().position(|g| g.id == group_id) else {
      return;
    };
    if self.state.groups[gi].state == GroupState::Finished {
      return;
    }
    // Only invalidate start tokens. Already running tasks finish during draining.
    self.cancel_start_tokens(group_id);
    self.dequeue_group(group_id);
    let old = self.state.groups[gi].state;
    if old != GroupState::Draining {
      self.state.groups[gi].state = GroupState::Draining;
      self.emit_group_state(group_id, old, GroupState::Draining);
    }
    // Mark pending tasks cancelled in bulk; the frontend refreshes from group state and snapshots.
    for t in self.state.groups[gi].tasks.iter_mut() {
      if t.state == TaskState::Pending {
        t.state = TaskState::Cancelled;
      }
    }
    self.recount_runtime(group_id);
    self.dirty_groups.insert(group_id.into());
    self.complete_pause(group_id).await;
    self.maybe_finish_group(group_id).await;
  }

  async fn maybe_finish_group(&mut self, group_id: &str) {
    let Some(gi) = self.state.groups.iter().position(|g| g.id == group_id) else {
      return;
    };
    let st = self.state.groups[gi].state;
    if !self.state.runtime[group_id].running.is_empty() {
      return;
    }
    match st {
      GroupState::Active => {
        // An active group completes only when every task is Done.
        // A failed task may still be waiting for an automatic retry and return to Pending.
        // Otherwise fail_group moves the group to Draining before it can finish.
        if !self.state.runtime[group_id].remaining.is_empty() {
          return;
        }
      }
      GroupState::Draining => {
        if self.state.runtime[group_id].nonterminal != 0 {
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
    let mut finished = self.state.groups[gi].clone();
    finished.state = GroupState::Finished;
    finished.finish = Some(finish);
    finished.completion_pending = finish == FinishKind::Completed;
    // Persist the action before notifying subscribers so snapshots can reconcile it.
    if let Err(error) = self.persistence.save(finished.clone()).await {
      tracing::warn!("persist finished group {group_id} failed: {error}");
      self.pending_finishes.insert(group_id.into());
      return;
    }
    self.state.groups[gi] = finished;
    self.pending_finishes.remove(group_id);
    self.dirty_groups.remove(group_id);
    self.emit_completed_progress();
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
  }

  // ---------- Scheduling ----------

  async fn dispatch_step(&mut self) {
    // Activate queued groups while group slots are available.
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
      // A crash can leave the last task durable before the group's completion record.
      if self.state.runtime[&gid].remaining.is_empty() {
        self.maybe_finish_group(&gid).await;
      }
    }
    // Dispatch tasks from the ready queue.
    while let Some(tid) = self.state.ready.pop_front() {
      self.state.ready_ids.remove(&tid);
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
        // The worker channel is full; retry this task on the next dispatch tick.
        self.state.ready_ids.insert(tid.clone());
        self.state.ready.push_front(tid);
        break;
      }
      // Mark the task queued until the worker's start request is processed.
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
    let next_order = self.state.runtime[group_id]
      .remaining
      .first_key_value()
      .map(|(stage, _)| *stage);
    let tids: Vec<String> = self.state.groups[gi]
      .tasks
      .iter()
      .filter(|t| {
        t.state == TaskState::Pending
          && next_order.is_some_and(|order| {
            self
              .executors
              .get(&t.executor)
              .map_or(0, |ex| ex.postprocess_order())
              == order
          })
      })
      .map(|t| t.id.clone())
      .collect();
    for tid in tids {
      self.enqueue_one(group_id, &tid);
    }
  }

  fn enqueue_one(&mut self, group_id: &str, task_id: &str) {
    // Avoid re-enqueueing tasks already in the ready queue or worker channel.
    // queued is set only after try_send succeeds; entries still in ready have queued=false.
    if self.state.ready_ids.contains(task_id)
      || self.state.runtime[group_id].running.contains(task_id)
    {
      return;
    }
    if let Some(rt) = self
      .state
      .runtime
      .get_mut(group_id)
      .and_then(|g| g.tasks.get_mut(task_id))
      && !rt.queued
    {
      self.state.ready_ids.insert(task_id.into());
      self.state.ready.push_back(task_id.to_string());
    }
  }

  /// Remove a group's tasks from the ready queue so they can be re-enqueued later.
  fn dequeue_group(&mut self, group_id: &str) {
    let mut keep = VecDeque::new();
    while let Some(tid) = self.state.ready.pop_front() {
      let belongs = self
        .find(&tid)
        .map(|(gi, _)| self.state.groups[gi].id == group_id)
        .unwrap_or(false);
      if belongs {
        self.state.ready_ids.remove(&tid);
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

  /// Invalidate queued jobs during fail-fast draining; leave active tasks running.
  fn cancel_start_tokens(&mut self, group_id: &str) {
    let Some(rtg) = self.state.runtime.get_mut(group_id) else {
      return;
    };
    for rt in rtg.tasks.values_mut() {
      rt.start_token.cancel();
    }
  }

  /// Invalidate queued and active jobs on pause or cancel.
  fn cancel_all_tokens(&mut self, group_id: &str) {
    let Some(rtg) = self.state.runtime.get_mut(group_id) else {
      return;
    };
    for rt in rtg.tasks.values_mut() {
      rt.start_token.cancel();
      rt.run_token.cancel();
    }
  }

  /// Create fresh tokens after resume or retry, once all previous executions have exited.
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
    // Activate a newly submitted group immediately when a slot is available.
    if self.active_group_count() < self.cfg.max_active_groups.max(1)
      && let Some(gi) = self
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
    let mut out: Vec<Progress> = self
      .completed_progress
      .drain()
      .map(|(_, progress)| progress)
      .collect();
    for gi in 0..self.state.groups.len() {
      let gid = self.state.groups[gi].id.clone();
      let mut items: Vec<(String, TaskState, u64, u64, f64, Option<f64>)> = Vec::new();
      // Collect task data first to avoid overlapping mutable borrows.
      for t in &self.state.groups[gi].tasks {
        // Only active tasks need periodic progress. State events and snapshots cover paused
        // and pending tasks, avoiding repeated frontend updates after a pause.
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
            speed = rt.update_speed(received, now);
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

  fn emit_completed_progress(&mut self) {
    if !self.completed_progress.is_empty() {
      let progress = self
        .completed_progress
        .drain()
        .map(|(_, progress)| progress)
        .collect();
      self.emit(EngineEvent::Tick(progress));
    }
  }

  fn flush_persistence(&mut self) {
    self.dirty_groups.extend(self.persistence.take_failed());
    for id in self.dirty_groups.drain() {
      if let Some(group) = self.state.groups.iter().find(|g| g.id == id) {
        self.persistence.schedule(group.clone());
      }
    }
  }

  async fn persist_group(&mut self, group_id: &str) -> Result<(), EngineError> {
    if let Some(group) = self.state.groups.iter().find(|g| g.id == group_id) {
      self.dirty_groups.insert(group_id.into());
      self.persistence.save(group.clone()).await?;
      self.dirty_groups.remove(group_id);
    }
    Ok(())
  }
}

fn download_sources(task: &Task) -> Vec<&str> {
  if task.executor != "download" {
    return Vec::new();
  }
  let mut sources = Vec::new();
  for url in task
    .spec
    .get("url")
    .into_iter()
    .chain(
      task
        .spec
        .get("fallbackUrls")
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten(),
    )
    .filter_map(serde_json::Value::as_str)
    .filter(|url| !url.is_empty())
  {
    if !sources.contains(&url) {
      sources.push(url);
    }
  }
  sources
}

fn advance_download_source(task: &mut Task) -> Result<bool, TaskError> {
  let mut sources: Vec<_> = download_sources(task)
    .into_iter()
    .map(str::to_owned)
    .collect();
  if sources.len() < 2 {
    return Ok(false);
  }
  // A partial file belongs to its source; never append bytes from a different source.
  if let Some(dest) = &task.dest {
    let mut path = dest.as_os_str().to_owned();
    path.push(".part");
    match std::fs::remove_file(std::path::PathBuf::from(path)) {
      Ok(()) => {}
      Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
      Err(error) => {
        return Err(error.into());
      }
    }
  }
  sources.rotate_left(1);
  task.spec["url"] = sources.remove(0).into();
  task.spec["fallbackUrls"] = sources.into();
  task.offset = 0;
  task.received = 0;
  task.total = task
    .spec
    .get("size")
    .and_then(|size| size.as_u64())
    .unwrap_or(0);
  task.verified = false;
  Ok(true)
}

fn delete_part(task: &Task) {
  if let Some(dest) = &task.dest {
    let mut s = dest.as_os_str().to_owned();
    s.push(".part");
    let _ = std::fs::remove_file(std::path::PathBuf::from(s));
  }
}
