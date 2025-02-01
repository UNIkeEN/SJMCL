use crate::error::SJMCLResult;
use crate::launcher_config::commands::retrieve_launcher_config;
use crate::tasks::*;
use futures::lock::Mutex as AsyncMutex;
use futures::stream::FuturesUnordered;
use futures::StreamExt;
use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use std::collections::HashMap;
use std::future::Future;
use std::num::NonZero;
use std::pin::Pin;
use std::sync::atomic::AtomicU32;
use std::vec::Vec;
use tauri::AppHandle;
use tokio::sync::Notify;

#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub enum MonitorState {
  Stopped,
  Completed,
  Cancelled,
  InProgress,
}

type SJMCLBoxedFuture = Pin<Box<dyn Future<Output = SJMCLResult<u32>> + Send>>;

pub struct TaskMonitor {
  handle: AppHandle,
  counter: AtomicU32,
  states: Mutex<HashMap<u32, Arc<Mutex<TaskState>>>>,
  notify: Arc<Notify>,
  concurrency: usize,
  pub tasks: AsyncMutex<FuturesUnordered<SJMCLBoxedFuture>>,
  pub waitlist: AsyncMutex<Vec<SJMCLBoxedFuture>>,
  pub download_rate_limiter: Option<DefaultDirectRateLimiter>,
}

impl TaskMonitor {
  pub fn new(handle: AppHandle, notify: Arc<Notify>) -> Self {
    let config = retrieve_launcher_config(handle.clone()).unwrap();
    TaskMonitor {
      counter: AtomicU32::new(0),
      handle: handle.clone(),
      states: Mutex::new(HashMap::new()),
      notify,
      concurrency: config.download.transmission.concurrent_count,
      tasks: AsyncMutex::new(FuturesUnordered::default()),
      waitlist: AsyncMutex::new(Vec::new()),
      download_rate_limiter: if config.download.transmission.enable_speed_limit {
        Some(RateLimiter::direct(Quota::per_second(
          NonZero::new(config.download.transmission.speed_limit_value as u32).unwrap(),
        )))
      } else {
        None
      },
    }
  }

  pub fn get_new_id(&self) -> u32 {
    self
      .counter
      .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
  }

  pub async fn enqueue_task<'a, T>(
    &'a self,
    id: u32,
    task_group: Option<String>,
    task: T,
    task_state: Option<Arc<Mutex<TaskState>>>,
  ) where
    T: Future<Output = SJMCLResult<()>> + Send + 'static,
  {
    let handle = self.handle.clone();
    let state = if let Some(state) = task_state {
      state
    } else {
      unimplemented!()
    };

    self.states.lock().unwrap().insert(id, state.clone());
    TaskEvent::emit_created(&handle, id, task_group.clone().as_deref());

    let task = Box::pin(async move {
      if state.lock().unwrap().is_cancelled() {
        return Ok(id);
      }

      let result = task.await;
      let state = state.lock().unwrap();

      if let Err(e) = result {
        TaskEvent::emit_failed(&handle, id, state.task_group.as_deref(), e.0.clone());
      }

      if state.is_cancelled() {
        TaskEvent::emit_cancelled(&handle, id, state.task_group.as_deref());
      } else if state.is_completed() {
        TaskEvent::emit_completed(&handle, id, state.task_group.as_deref());
        state.delete().unwrap();
      }
      Ok(id)
    });

    let tasks = self.tasks.lock().await;
    if tasks.len() >= self.concurrency {
      self.waitlist.lock().await.push(task);
      return;
    }

    tasks.push(task);
    if tasks.len() >= 1 {
      self.notify.notify_waiters();
    }
  }

  pub async fn background_process(&self) {
    loop {
      let mut tasks = self.tasks.lock().await;
      if tasks.is_empty() {
        drop(tasks);
        self.notify.notified().await; // wait for new tasks
        continue;
      }
      let r = tasks.select_next_some().await;
      if tasks.len() < self.concurrency {
        let mut waitlist = self.waitlist.lock().await;
        if !waitlist.is_empty() {
          tasks.push(waitlist.pop().unwrap());
        }
      }
      log::info!("progress_monitor: {:?}", r);
    }
  }

  pub fn stop_progress(&self, id: u32) {
    if let Some(state) = self.states.lock().unwrap().get_mut(&id) {
      state.lock().unwrap().stop();
    }
  }

  pub fn resume_progress(&self, id: u32) {
    if let Some(state) = self.states.lock().unwrap().get_mut(&id) {
      state.lock().unwrap().resume();
    }
  }

  pub fn cancel_progress(&self, id: u32) {
    if let Some(state) = self.states.lock().unwrap().get_mut(&id) {
      state.lock().unwrap().cancel()
    }
  }

  pub fn state_list(&self) -> Vec<TaskState> {
    self
      .states
      .lock()
      .unwrap()
      .values()
      .map(|v| v.lock().unwrap().clone())
      .collect()
  }
}
