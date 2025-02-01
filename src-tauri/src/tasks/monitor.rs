use crate::error::SJMCLResult;
use crate::tasks::*;
use futures::lock::Mutex as AsyncMutex;
use futures::stream::FuturesUnordered;
use futures::Stream;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::AtomicU32;
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub enum MonitorState {
  Stopped,
  Completed,
  Cancelled,
  InProgress,
}

impl MonitorState {
  pub fn stop(&mut self) {
    *self = MonitorState::Stopped;
  }
  pub fn complete(&mut self) {
    *self = MonitorState::Completed;
  }
  pub fn cancel(&mut self) {
    *self = MonitorState::Cancelled;
  }
  pub fn resume(&mut self) {
    if *self == MonitorState::Stopped {
      *self = MonitorState::InProgress;
    }
  }
}

type SJMCLBoxedFuture = Pin<Box<dyn Future<Output = SJMCLResult<u32>> + Send + 'static>>;

pub struct TaskMonitor {
  counter: AtomicU32,
  handle: AppHandle,
  cache_dir: PathBuf,
  pub tasks: AsyncMutex<FuturesUnordered<SJMCLBoxedFuture>>,
  states: Mutex<HashMap<u32, Arc<Mutex<TaskState>>>>,
}

impl TaskMonitor {
  pub fn new(handle: AppHandle, cache_dir: PathBuf) -> Self {
    TaskMonitor {
      counter: AtomicU32::new(0),
      handle: handle.clone(),
      cache_dir,
      tasks: AsyncMutex::new(FuturesUnordered::default()),
      states: Mutex::new(HashMap::new()),
    }
  }

  pub fn get_new_id(&self) -> u32 {
    self
      .counter
      .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
  }

  pub async fn enqueue_task<T>(&self, id: u32, task: T, task_state: Option<Arc<Mutex<TaskState>>>)
  where
    T: Future<Output = SJMCLResult<()>> + Send + 'static,
  {
    let handle = self.handle.clone();

    let state = if let Some(state) = task_state {
      state
    } else {
      unimplemented!()
    };

    self.states.lock().unwrap().insert(id, state.clone());
    TaskEvent::emit_created(&handle, id);
    self.tasks.lock().await.push(Box::pin(async move {
      if state.lock().unwrap().monitor_state == MonitorState::Cancelled {
        return Ok(id);
      }

      let result = task.await;
      match &result {
        Ok(()) => TaskEvent {
          id,
          event: TaskEventContent::Completed,
        },
        Err(e) => TaskEvent {
          id,
          event: TaskEventContent::Failed {
            reason: e.0.clone(),
          },
        },
      }
      .emit(&handle);
      Ok(id)
    }))
  }

  pub fn stop_progress(&self, id: u32) {
    if let Some(state) = self.states.lock().unwrap().get_mut(&id) {
      state.lock().unwrap().monitor_state.stop()
    }
  }

  pub fn resume_progress(&self, id: u32) {
    if let Some(state) = self.states.lock().unwrap().get_mut(&id) {
      state.lock().unwrap().monitor_state.resume();
    }
  }

  pub fn cancel_progress(&self, id: u32) {
    if let Some(state) = self.states.lock().unwrap().get_mut(&id) {
      state.lock().unwrap().monitor_state.cancel()
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
