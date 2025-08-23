use crate::launcher_config::commands::retrieve_launcher_config;
use crate::utils::fs::extract_filename;

use super::download;
use super::reporter::{GroupReporter, TaskReporter};

use super::RuntimeTaskParam;
use flume::{Receiver, Sender};
use log::info;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::atomic::AtomicU32;
use std::sync::{Arc, Mutex, RwLock};
use std::task::{Context, Poll};
use std::time::{Duration, SystemTime};
use tauri::AppHandle;
use thiserror::Error;
use tokio::io::{AsyncRead, ReadBuf};
use tokio::sync::Semaphore;
use tokio::task::JoinHandle;
use tokio::time::Interval;

pub type TaskId = u32;
pub type TaskResult = std::io::Result<()>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RuntimeState {
  #[serde(rename_all = "camelCase")]
  Stopped {
    stopped_at: SystemTime,
  },
  #[serde(rename_all = "camelCase")]
  Failed {
    reason: String,
  },
  InProgress,
  #[serde(rename_all = "camelCase")]
  Completed {
    completed_at: SystemTime,
  },
  Cancelled,
  Pending,
}

impl RuntimeState {
  pub fn is_stopped(&self) -> bool {
    matches!(self, RuntimeState::Stopped { .. })
  }

  pub fn is_failed(&self) -> bool {
    matches!(self, RuntimeState::Failed { .. })
  }

  pub fn is_completed(&self) -> bool {
    matches!(self, RuntimeState::Completed { .. })
  }
  pub fn is_in_progress(&self) -> bool {
    matches!(self, RuntimeState::InProgress)
  }
  pub fn is_pending(&self) -> bool {
    matches!(self, RuntimeState::Pending)
  }

  pub fn is_cancelled(&self) -> bool {
    matches!(self, RuntimeState::Cancelled)
  }

  pub fn pollable(&self) -> bool {
    matches!(self, RuntimeState::InProgress | RuntimeState::Pending)
  }

  pub fn set_in_progress(&mut self) {
    *self = RuntimeState::InProgress;
  }

  pub fn set_pending(&mut self) {
    *self = RuntimeState::Pending;
  }

  pub fn set_stopped(&mut self) {
    *self = RuntimeState::Stopped {
      stopped_at: SystemTime::now(),
    };
  }
  pub fn set_failed(&mut self, reason: String) {
    *self = RuntimeState::Failed { reason };
  }

  pub fn set_cancelled(&mut self) {
    *self = RuntimeState::Cancelled;
  }

  pub fn set_completed(&mut self) {
    *self = RuntimeState::Completed {
      completed_at: SystemTime::now(),
    };
  }
}

type RuntimeTaskState = RuntimeState;
pub type RuntimeGroupState = RuntimeState;
type RuntimeGroupDescRwLock = Arc<RwLock<RuntimeGroupDesc>>;
type SharedRuntimeTaskHandle = Arc<RuntimeTaskHandle>;
type ConcurrentHashMap<K, V> = Arc<Mutex<HashMap<K, V>>>;
type ConcurrentHashSet<K> = Arc<Mutex<HashSet<K>>>;
pub type PinnedFuture<'a> = Pin<Box<dyn Future<Output = TaskResult> + Send + 'a>>;
pub type RuntimeGroupStateRwLock = Arc<RwLock<RuntimeGroupState>>;
pub type RuntimeTaskDescRwLock = Arc<RwLock<RuntimeTaskDesc>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeTaskDesc {
  pub id: u32,
  pub group: Option<String>,
  started_at: SystemTime,
  created_at: SystemTime,
  #[serde(skip)]
  pub path: PathBuf,
  pub current: u64,
  pub total: u64,
  pub param: RuntimeTaskParam,
  pub state: RuntimeTaskState,
}

impl RuntimeTaskDesc {
  pub fn new(app: AppHandle, id: u32, group: Option<String>, param: RuntimeTaskParam) -> Self {
    let cache_dir = retrieve_launcher_config(app.clone())
      .unwrap()
      .download
      .cache
      .directory;
    Self {
      id,
      group,
      started_at: SystemTime::UNIX_EPOCH,
      created_at: SystemTime::now(),
      path: cache_dir.clone().join(format!("task-{id}.json")),
      current: 0,
      total: 0,
      param,
      state: RuntimeTaskState::Pending,
    }
  }

  fn reset(&mut self) {
    self.started_at = SystemTime::now();
    self.current = 0;
    self.total = 0;
    self.state = RuntimeTaskState::Pending;
  }

  pub fn save(&self) -> std::io::Result<()> {
    let file = std::fs::File::create(&self.path)?;
    serde_json::to_writer(file, self)?;
    Ok(())
  }

  fn load(path: PathBuf) -> std::io::Result<Self> {
    let file = std::fs::File::open(&path)?;
    let mut desc: Self = serde_json::from_reader(file)?;
    desc.path = path;
    Ok(desc)
  }

  fn snapshot(&self) -> RuntimeTaskDescSnapshot {
    match self.param.clone() {
      RuntimeTaskParam::Download(param) => RuntimeTaskDescSnapshot {
        state: self.state.clone(),
        total: self.total,
        current: self.current,
        start_at: self.started_at,
        created_at: self.created_at,
        filename: param.filename.unwrap_or_default(),
        dest: param.dest,
      },
    }
  }
}

fn into_runtime_task<'a>(
  app_handle: AppHandle,
  desc: RuntimeTaskDescRwLock,
  group_state: RuntimeGroupStateRwLock,
  reporter: &'a mut TaskReporter,
) -> PinnedFuture<'a> {
  match desc.read().unwrap().param.clone() {
    RuntimeTaskParam::Download(param) => Box::pin(download::into_runtime_task(
      app_handle,
      group_state,
      desc.clone(),
      param,
      reporter,
    )),
  }
}

pub struct RuntimeTaskHandle {
  group_state: RuntimeGroupStateRwLock,
  desc: RuntimeTaskDescRwLock,
}

impl RuntimeTaskHandle {
  pub fn new(group_state: RuntimeGroupStateRwLock, desc: RuntimeTaskDescRwLock) -> Self {
    Self { group_state, desc }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeStatefulSet<T>
where
  T: Clone + Eq + std::hash::Hash,
{
  pending: VecDeque<T>,
  failed: HashSet<T>,
  completed: HashSet<T>,
  stopped: HashSet<T>,
  cancelled: HashSet<T>,
  running: HashSet<T>,
  tracked: usize,
}

#[derive(Clone)]
pub enum TaskCommand {
  Stop,
  Resume,
  Restart,
  Retry,
  Cancel,
}

impl<T> RuntimeStatefulSet<T>
where
  T: Clone + Eq + std::hash::Hash,
{
  fn new<I: IntoIterator<Item = T>>(id_set: I) -> Self {
    let pending = VecDeque::from_iter(id_set);
    let tracked = pending.len();
    Self {
      pending,
      failed: Default::default(),
      completed: Default::default(),
      stopped: Default::default(),
      cancelled: Default::default(),
      running: Default::default(),
      tracked,
    }
  }

  fn start_one(&mut self) -> Option<T> {
    if let Some(id) = self.pending.pop_front() {
      self.running.insert(id.clone());
      Some(id)
    } else {
      None
    }
  }

  fn complete_one(&mut self, id: T) {
    let _ = self.running.remove(&id);
    self.completed.insert(id);
  }

  fn fail_one(&mut self, id: T) {
    let _ = self.running.remove(&id);
    self.failed.insert(id);
  }

  fn stop_one(&mut self, id: T) {
    if let Some(pos) = self.pending.iter().position(|x| *x == id) {
      self.stopped.insert(self.pending.remove(pos).unwrap());
    } else if let Some(id) = self.running.take(&id) {
      self.stopped.insert(id.clone());
    }
  }

  fn stop_all(&mut self) {
    self.stopped.extend(self.pending.drain(..));
    self.stopped.extend(self.running.drain());
  }

  fn cancel_all(&mut self) {
    self.cancelled.extend(self.pending.drain(..));
    self.cancelled.extend(self.stopped.drain());
    self.cancelled.extend(self.running.drain());
  }

  fn cancel_one(&mut self, id: T) {
    if let Some(pos) = self.pending.iter().position(|x| *x == id) {
      self.cancelled.insert(self.pending.remove(pos).unwrap());
    }
    self.running.remove(&id);
    self.stopped.remove(&id);
    self.cancelled.insert(id);
  }

  fn resume_all(&mut self) {
    self.pending.extend(self.stopped.drain());
  }

  fn resume_one(&mut self, id: T) {
    self.stopped.remove(&id);
    self.pending.push_back(id);
  }

  fn retry_one(&mut self, id: T) {
    self.cancelled.remove(&id);
    self.failed.remove(&id);
    self.pending.push_back(id);
  }

  fn retry_all(&mut self) {
    self.pending.extend(self.failed.drain());
    self.pending.extend(self.cancelled.drain())
  }

  fn restart_one(&mut self, id: T) {
    self.cancelled.remove(&id);
    self.stopped.remove(&id);
    self.failed.remove(&id);
    self.completed.remove(&id);
    self.pending.push_back(id);
  }

  fn restart_all(&mut self) {
    self.pending.extend(self.stopped.drain());
    self.pending.extend(self.failed.drain());
    self.pending.extend(self.completed.drain());
    self.pending.extend(self.cancelled.drain())
  }

  pub fn combine_all_states(&self) -> RuntimeState {
    if !self.cancelled.is_empty() {
      return RuntimeState::Cancelled;
    }

    if !self.stopped.is_empty() {
      return RuntimeState::Stopped {
        stopped_at: SystemTime::now(),
      };
    }

    if !self.failed.is_empty() && self.pending.is_empty() {
      return RuntimeState::Failed {
        reason: "Some tasks failed".to_string(),
      };
    }

    if self.pending.len() == self.tracked {
      return RuntimeState::Pending;
    }

    if self.completed.len() == self.tracked {
      RuntimeState::Completed {
        completed_at: SystemTime::now(),
      }
    } else {
      RuntimeState::InProgress
    }
  }

  fn retry_set(&self) -> Vec<T> {
    self
      .cancelled
      .iter()
      .cloned()
      .chain(self.failed.iter().cloned())
      .collect()
  }

  fn restart_set(&self) -> Vec<T> {
    self
      .cancelled
      .iter()
      .cloned()
      .chain(self.failed.iter().cloned())
      .chain(self.running.iter().cloned())
      .chain(self.completed.iter().cloned())
      .chain(self.stopped.iter().cloned())
      .collect()
  }

  fn apply_all(&mut self, cmd: TaskCommand) {
    match cmd {
      TaskCommand::Stop => self.stop_all(),
      TaskCommand::Resume => self.resume_all(),
      TaskCommand::Restart => self.restart_all(),
      TaskCommand::Cancel => self.cancel_all(),
      TaskCommand::Retry => self.retry_all(),
    }
  }

  fn apply_one(&mut self, id: T, cmd: TaskCommand) {
    match cmd {
      TaskCommand::Stop => self.stop_one(id),
      TaskCommand::Resume => self.resume_one(id),
      TaskCommand::Restart => self.restart_one(id),
      TaskCommand::Cancel => self.cancel_one(id),
      TaskCommand::Retry => self.retry_one(id),
    }
  }
}

impl RuntimeState {
  pub fn apply(&mut self, cmd: TaskCommand) {
    match cmd {
      TaskCommand::Stop => self.set_stopped(),
      TaskCommand::Resume => self.set_in_progress(),
      TaskCommand::Restart => self.set_pending(),
      TaskCommand::Retry => self.set_pending(),
      TaskCommand::Cancel => self.set_cancelled(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RuntimeGroupDesc {
  name: String,
  state: RuntimeGroupStateRwLock,
  started_at: SystemTime,
  created_at: SystemTime,
  task_desc_map: HashMap<TaskId, RuntimeTaskDescRwLock>,
  stateful_set: RuntimeStatefulSet<TaskId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeTaskDescSnapshot {
  state: RuntimeTaskState,
  total: u64,
  current: u64,
  start_at: SystemTime,
  created_at: SystemTime,
  filename: String,
  dest: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeGroupDescSnapshot {
  name: String,
  state: RuntimeGroupState,
  task_desc_map: HashMap<TaskId, RuntimeTaskDescSnapshot>,
}

impl RuntimeGroupDesc {
  fn new(name: String, task_desc_map: HashMap<TaskId, RuntimeTaskDescRwLock>) -> Self {
    let id_set: Vec<TaskId> = task_desc_map.keys().copied().collect();
    Self {
      name,
      state: Arc::new(RwLock::new(RuntimeState::Pending)),
      started_at: SystemTime::UNIX_EPOCH,
      created_at: SystemTime::now(),
      task_desc_map,
      stateful_set: RuntimeStatefulSet::new(id_set),
    }
  }
  fn apply(&mut self, handle_map: &mut HashMap<TaskId, JoinHandle<()>>, cmd: TaskCommand) -> bool {
    self.state.write().unwrap().apply(cmd.clone());
    let resched = match cmd {
      TaskCommand::Restart => {
        for id in self.stateful_set.restart_set() {
          handle_map.remove(&id);
          self
            .task_desc_map
            .get_mut(&id)
            .unwrap()
            .write()
            .unwrap()
            .reset();
        }
        true
      }
      TaskCommand::Retry => {
        for id in self.stateful_set.retry_set() {
          handle_map.remove(&id);
          self
            .task_desc_map
            .get_mut(&id)
            .unwrap()
            .write()
            .unwrap()
            .reset();
        }
        true
      }
      _ => false,
    };
    self.stateful_set.apply_all(cmd.clone());
    resched
  }
  fn snapshot(&self) -> RuntimeGroupDescSnapshot {
    let task_desc_map = self
      .task_desc_map
      .iter()
      .map(|(id, desc)| (*id, desc.read().unwrap().snapshot()))
      .collect();
    RuntimeGroupDescSnapshot {
      name: self.name.clone(),
      state: self.state.read().unwrap().clone(),
      task_desc_map,
    }
  }
}

pub struct RuntimeTaskProgressReader<'a, A> {
  reader: A,
  handle: RuntimeTaskHandle,
  reporter: &'a mut TaskReporter,
  interval: Interval,
}

impl<'a, A> RuntimeTaskProgressReader<'a, A> {
  pub fn new(
    reader: A,
    group_state: RuntimeGroupStateRwLock,
    desc: RuntimeTaskDescRwLock,
    reporter: &'a mut TaskReporter,
  ) -> Self
  where
    A: AsyncRead + Unpin,
  {
    let handle = RuntimeTaskHandle::new(group_state, desc);
    let interval = tokio::time::interval(Duration::from_secs(1));
    Self {
      reader,
      handle,
      reporter,
      interval,
    }
  }
}

#[derive(Debug, Error)]
pub enum RuntimeTaskProgressError {
  #[error("The task has been stopped externally")]
  ExternalInterrupted,
}

impl<'a, A> AsyncRead for RuntimeTaskProgressReader<'a, A>
where
  A: AsyncRead + Unpin,
{
  fn poll_read(
    self: Pin<&mut Self>,
    cx: &mut Context<'_>,
    buf: &mut ReadBuf<'_>,
  ) -> Poll<std::io::Result<()>> {
    let this = self.get_mut();
    {
      let group_state = this.handle.group_state.read().unwrap();
      let mut desc = this.handle.desc.write().unwrap();
      if !group_state.pollable() || !desc.state.pollable() {
        return Poll::Ready(Err(std::io::Error::other(Box::new(
          RuntimeTaskProgressError::ExternalInterrupted,
        ))));
      }
      Pin::new(&mut this.reader).poll_read(cx, buf).map_ok(|()| {
        desc.current += buf.filled().len() as u64;
        if this.interval.poll_tick(cx).is_ready() {
          desc.save().unwrap();
          this.reporter.report_progress(desc.current as i64)
        }
      })
    }
  }
}

pub struct IdGenerator {
  seq: AtomicU32,
}

impl Default for IdGenerator {
  fn default() -> Self {
    Self { seq: 0.into() }
  }
}

impl IdGenerator {
  fn next_id(&self) -> u32 {
    self.seq.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
  }
}

pub struct TaskMonitor {
  app_handle: tauri::AppHandle,
  group_descs: ConcurrentHashMap<String, RuntimeGroupDescRwLock>,
  inqueue: ConcurrentHashSet<String>,
  handle_map: ConcurrentHashMap<TaskId, JoinHandle<()>>,
  tx: Sender<String>,
  rx: Receiver<String>,
  sema: Arc<Semaphore>,
  id_gen: IdGenerator,
  report_period: Duration,
}

impl TaskMonitor {
  pub fn new(app_handle: AppHandle) -> Self {
    let (tx, rx) = flume::unbounded();
    let config = retrieve_launcher_config(app_handle.clone()).unwrap();
    let concurrency = if config.download.transmission.auto_concurrent {
      std::thread::available_parallelism().unwrap().into()
    } else {
      config.download.transmission.concurrent_count
    };
    Self {
      app_handle,
      group_descs: Default::default(),
      inqueue: Default::default(),
      handle_map: Default::default(),
      tx,
      rx,
      sema: Arc::new(Semaphore::new(concurrency)),
      id_gen: IdGenerator::default(),
      report_period: Duration::from_secs(1),
    }
  }
  pub async fn schedule_task_group(
    &self,
    group_name: String,
    params: Vec<RuntimeTaskParam>,
  ) -> RuntimeGroupDescSnapshot {
    let task_desc_map: HashMap<u32, RuntimeTaskDescRwLock> =
      HashMap::from_iter(params.into_iter().map(|param| {
        let task_id = self.id_gen.next_id();
        let task_desc = match param {
          RuntimeTaskParam::Download(mut param) => {
            if param.filename.is_none() {
              param.filename = Some(extract_filename(
                param.dest.to_str().unwrap_or_default(),
                true,
              ));
            }
            Arc::new(RwLock::new(RuntimeTaskDesc::new(
              self.app_handle.clone(),
              task_id,
              Some(group_name.clone()),
              RuntimeTaskParam::Download(param),
            )))
          }
        };
        (task_id, task_desc)
      }));
    let group_desc = RuntimeGroupDesc::new(group_name.clone(), task_desc_map);
    let snapshot = group_desc.snapshot();
    self
      .group_descs
      .lock()
      .unwrap()
      .insert(group_name.clone(), Arc::new(RwLock::new(group_desc)));
    self.inqueue.lock().unwrap().insert(group_name.clone());
    self.tx.send_async(group_name.clone()).await.unwrap();
    let group_reporter = GroupReporter::new(self.app_handle.clone(), group_name.clone());
    group_reporter.report(&RuntimeGroupState::Pending);
    snapshot
  }

  pub async fn background_process(&self) {
    loop {
      let group_name = self.rx.recv_async().await.unwrap();
      let group_desc = self
        .group_descs
        .lock()
        .unwrap()
        .get(&group_name)
        .unwrap()
        .clone();
      let group_reporter = GroupReporter::new(self.app_handle.clone(), group_name.clone());
      self.inqueue.lock().unwrap().remove(&group_name);
      loop {
        let (task_desc, group_state, task_id) = {
          let mut group_desc = group_desc.write().unwrap();
          let state = group_desc.state.clone();
          let mut group_state = state.write().unwrap();

          if !group_state.pollable() {
            break;
          }

          if group_state.is_pending() {
            group_state.set_in_progress();
            group_reporter.report(&group_state);
          }

          let task_id_option = group_desc.stateful_set.start_one();

          if task_id_option.is_none() {
            break;
          }

          let task_id = task_id_option.unwrap();
          (
            group_desc.task_desc_map.get(&task_id).unwrap().clone(),
            state.clone(),
            task_id,
          )
        };

        let handle = {
          let app_handle = self.app_handle.clone();
          let permit = self.sema.clone().acquire_owned().await.unwrap();
          let report_period = self.report_period.clone();
          let task_group_state = group_desc.read().unwrap().state.clone();
          let task_group_desc = group_desc.clone();
          let task_handle_map = self.handle_map.clone();
          let task_group_reporter = group_reporter.clone();

          tokio::spawn(async move {
            // Create Task Reporter for this task
            let mut task_reporter = {
              let desc = task_desc.read().unwrap();
              let group_name = desc.group.clone();
              TaskReporter::from_desc_interval(
                app_handle.clone(),
                group_name,
                &desc,
                &report_period,
              )
            };
            // Create the runtime task, erase the type for dispatching.
            let task = into_runtime_task(
              app_handle,
              task_desc.clone(),
              group_state,
              &mut task_reporter,
            );
            let _ = permit;
            let r = task.await;
            {
              let mut group_desc = task_group_desc.write().unwrap();
              let mut group_state = task_group_state.write().unwrap();
              let mut task_desc = task_desc.write().unwrap();
              match r {
                Ok(_) => {
                  group_desc.stateful_set.complete_one(task_id);
                  task_desc.state.set_completed();
                }
                Err(e) => {
                  let reason = e.to_string();
                  if e.downcast::<RuntimeTaskProgressError>().is_err() {
                    group_desc.stateful_set.fail_one(task_id);
                    task_desc.state.set_failed(reason.clone());
                  } else {
                    task_desc.state = group_state.clone();
                  }
                }
              }
              task_reporter.report(&task_desc);
              task_desc.save().unwrap();
              if group_state.pollable() {
                *group_state = group_desc.stateful_set.combine_all_states();
              }
              if !group_state.pollable() {
                task_group_reporter.report(&group_state);
              }
            }
            task_handle_map.lock().unwrap().remove(&task_id);
          })
        };
        self.handle_map.lock().unwrap().insert(task_id, handle);
      }
    }
  }

  pub async fn apply_cmd(&self, group_name: String, cmd: TaskCommand) {
    let group_desc_opt = self.group_descs.lock().unwrap().get(&group_name).cloned();
    if group_desc_opt.is_none() {
      return;
    }
    let group_desc = group_desc_opt.unwrap();
    if group_desc
      .write()
      .unwrap()
      .apply(&mut self.handle_map.lock().unwrap(), cmd.clone())
      && !self.inqueue.lock().unwrap().contains(&group_name)
    {
      self.tx.send_async(group_name).await.unwrap();
    }
  }

  pub fn state_list(&self) -> Vec<RuntimeGroupDescSnapshot> {
    let group_descs = self.group_descs.lock().unwrap();
    group_descs
      .values()
      .map(|desc| desc.read().unwrap().snapshot())
      .collect()
  }

  pub fn has_active_download_tasks(&self) -> bool {
    !self.handle_map.lock().unwrap().is_empty()
  }
}
