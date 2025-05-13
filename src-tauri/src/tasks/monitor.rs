use crate::error::SJMCLResult;
use crate::launcher_config::commands::retrieve_launcher_config;
use crate::tasks::*;
use download::DownloadTask;
use flume::{Receiver as FlumeReceiver, Sender as FlumeSender};
use glob::glob;
use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use log::info;
use std::collections::HashMap;
use std::future::Future;
use std::num::NonZero;
use std::pin::Pin;
use std::sync::atomic::AtomicU32;
use std::vec::Vec;
use tauri::AppHandle;
use tokio::sync::Semaphore;

#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub enum ProgressState {
  Stopped,
  Completed,
  Cancelled,
  InProgress,
}

type SJMCLBoxedFuture = Pin<Box<dyn Future<Output = SJMCLResult<u32>> + Send>>;

pub struct TaskMonitor {
  app_handle: AppHandle,
  id_counter: AtomicU32,
  p_descs: Mutex<HashMap<u32, Arc<Mutex<ProgressiveTaskDescriptor>>>>,
  t_descs: Mutex<HashMap<u32, TransientTaskDescriptor>>,
  concurrency: Arc<Semaphore>,
  tx: FlumeSender<SJMCLBoxedFuture>,
  rx: FlumeReceiver<SJMCLBoxedFuture>,
  pub download_rate_limiter: Option<DefaultDirectRateLimiter>,
}

impl TaskMonitor {
  pub fn new(app_handle: AppHandle) -> Self {
    let config = retrieve_launcher_config(app_handle.clone()).unwrap();
    let (tx, rx) = flume::unbounded();
    TaskMonitor {
      app_handle: app_handle.clone(),
      id_counter: AtomicU32::new(0),
      p_descs: Mutex::new(HashMap::new()),
      t_descs: Mutex::new(HashMap::new()),
      concurrency: Arc::new(Semaphore::new(
        if config.download.transmission.auto_concurrent {
          let parallelism: usize = std::thread::available_parallelism().unwrap().into();
          1 + (parallelism / 2_usize)
        } else {
          config.download.transmission.concurrent_count
        },
      )),
      tx,
      rx,
      download_rate_limiter: if config.download.transmission.enable_speed_limit {
        Some(RateLimiter::direct(Quota::per_second(
          NonZero::new(config.download.transmission.speed_limit_value as u32).unwrap(),
        )))
      } else {
        None
      },
    }
  }

  #[allow(clippy::manual_flatten)]
  pub async fn load_saved_tasks(&self) {
    let cache_dir = retrieve_launcher_config(self.app_handle.clone())
      .unwrap()
      .download
      .cache
      .directory;

    for entry in glob(&format!(
      "{}/descriptors/task_*.json",
      cache_dir.to_str().unwrap()
    ))
    .unwrap()
    {
      if let Ok(task) = entry {
        match ProgressiveTaskDescriptor::load(task.clone()) {
          Ok(desc) => {
            let task_id = desc.task_id;
            let task_group = desc.task_group.clone();
            match desc.task_type {
              ProgressiveTaskType::Download => {
                let task = DownloadTask::from_descriptor(
                  self.app_handle.clone(),
                  &desc,
                  Duration::from_secs(1),
                );
                if let Some(ratelimiter) = &self.download_rate_limiter {
                  let r: &'static DefaultDirectRateLimiter =
                    unsafe { std::mem::transmute(ratelimiter) };
                  let (f, state) = task.future_with_ratelimiter(r).await.unwrap();
                  self.enqueue_task(task_id, task_group, f, Some(state)).await;
                } else {
                  let (f, state) = task.future().await.unwrap();
                  self.enqueue_task(task_id, task_group, f, Some(state)).await;
                };
              }
            }
          }
          Err(_) => {
            info!("Failed to load task descriptor: {}", task.display());
          }
        }
      }
    }
  }

  pub fn get_new_id(&self) -> u32 {
    self
      .id_counter
      .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
  }

  pub async fn enqueue_task<T>(
    &self,
    id: u32,
    task_group: Option<String>,
    task: T,
    desc: Option<Arc<Mutex<ProgressiveTaskDescriptor>>>,
  ) where
    T: Future<Output = SJMCLResult<()>> + Send + 'static,
  {
    let handle = self.app_handle.clone();
    let state = if let Some(state) = desc {
      state
    } else {
      unimplemented!()
    };

    self.p_descs.lock().unwrap().insert(id, state.clone());
    ProgressiveTaskEvent::emit_created(&handle, id, task_group.clone().as_deref());

    let task = Box::pin(async move {
      if state.lock().unwrap().is_cancelled() {
        return Ok(id);
      }

      let result = task.await;
      let state = state.lock().unwrap();

      if let Err(e) = result {
        ProgressiveTaskEvent::emit_failed(&handle, id, state.task_group.as_deref(), e.0.clone());
      }

      if state.is_cancelled() {
        ProgressiveTaskEvent::emit_cancelled(&handle, id, state.task_group.as_deref());
      } else if state.is_completed() {
        ProgressiveTaskEvent::emit_completed(&handle, id, state.task_group.as_deref());
        state.delete().unwrap();
      }
      Ok(id)
    });

    self.tx.send_async(task).await.unwrap();
  }

  pub async fn background_process(&self) {
    loop {
      let task = self.rx.recv_async().await.unwrap();
      if self.concurrency.acquire().await.is_ok() {
        let concurrency = self.concurrency.clone();
        tokio::spawn(async move {
          let r = task.await;
          match r {
            Ok(id) => {
              info!("Task {:?} completed", id);
            }
            Err(e) => {
              info!("Task failed: {:?}", e);
            }
          }
          concurrency.add_permits(1);
        });
      }
    }
  }

  pub fn stop_progress(&self, id: u32) {
    if let Some(state) = self.p_descs.lock().unwrap().get_mut(&id) {
      state.lock().unwrap().stop();
    }
  }

  pub fn resume_progress(&self, id: u32) {
    if let Some(state) = self.p_descs.lock().unwrap().get_mut(&id) {
      state.lock().unwrap().resume();
    }
  }

  pub fn cancel_progress(&self, id: u32) {
    if let Some(state) = self.p_descs.lock().unwrap().get_mut(&id) {
      state.lock().unwrap().cancel()
    }
  }

  pub fn create_transient_task(&self, app: AppHandle, mut desc: TransientTaskDescriptor) {
    desc.task_id = self.get_new_id();
    TransientTaskEvent::new(&desc).emit(&app);
    self.t_descs.lock().unwrap().insert(desc.task_id, desc);
  }

  pub fn set_transient_task(&self, app: AppHandle, task_id: u32, state: String) {
    if let Some(desc) = self.t_descs.lock().unwrap().get_mut(&task_id) {
      desc.state = state;
      TransientTaskEvent::new(desc).emit(&app);
    }
  }

  pub fn cancel_transient_task(&self, task_id: u32) {
    self.t_descs.lock().unwrap().remove(&task_id);
  }

  pub fn get_transient_task(&self, task_id: u32) -> Option<TransientTaskDescriptor> {
    self.t_descs.lock().unwrap().get(&task_id).cloned()
  }

  pub fn state_list(&self) -> Vec<ProgressiveTaskDescriptor> {
    self
      .p_descs
      .lock()
      .unwrap()
      .values()
      .map(|v| v.lock().unwrap().clone())
      .collect()
  }
}
