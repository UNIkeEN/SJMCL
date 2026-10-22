use async_speed_limit::Limiter;
use flume::{Receiver as FlumeReceiver, Sender as FlumeSender};
use glob::glob;
use log::info;
use sjmcl_types::error::SJMCLResult;
use std::collections::HashMap;
use std::future::Future;
use std::sync::atomic::AtomicU32;
use std::sync::{Arc, Mutex, RwLock};
use std::vec::Vec;
use tauri::AppHandle;
use tauri::async_runtime::JoinHandle;
use tokio::sync::Semaphore;

use crate::launcher_config::commands::retrieve_launcher_config;
use crate::tasks::download::DownloadTask;
use crate::tasks::events::{GEvent, GEventStatus, PEvent, TEvent};
use crate::tasks::streams::desc::PStatus;
use crate::tasks::{SJMCLFuture, *};

pub struct GroupMonitor {
  pub phs: HashMap<u32, Arc<RwLock<PTaskHandle>>>,
  pub status: GEventStatus,
}

pub struct TaskMonitor {
  app_handle: AppHandle,
  id_counter: AtomicU32,
  phs: Arc<RwLock<HashMap<u32, Arc<RwLock<PTaskHandle>>>>>,
  ths: RwLock<HashMap<u32, THandle>>,
  tasks: Arc<Mutex<HashMap<u32, JoinHandle<()>>>>,
  concurrency: Arc<Semaphore>,
  tx: FlumeSender<SJMCLFuture>,
  rx: FlumeReceiver<SJMCLFuture>,
  group_map: Arc<RwLock<HashMap<String, GroupMonitor>>>,
  stopped_futures: Arc<Mutex<Vec<SJMCLFuture>>>,
  pub download_rate_limiter: Option<Limiter>,
}

impl TaskMonitor {
  pub fn new(app_handle: AppHandle) -> Self {
    let config = retrieve_launcher_config(app_handle.clone()).unwrap();
    let (tx, rx) = flume::unbounded();
    TaskMonitor {
      app_handle: app_handle.clone(),
      id_counter: AtomicU32::new(0),
      phs: Arc::new(RwLock::new(HashMap::new())),
      ths: RwLock::new(HashMap::new()),
      tasks: Arc::new(Mutex::new(HashMap::new())),
      concurrency: Arc::new(Semaphore::new(
        if config.download.transmission.auto_concurrent {
          std::thread::available_parallelism().unwrap().into()
        } else {
          config.download.transmission.concurrent_count
        },
      )),
      tx,
      rx,
      group_map: Arc::new(RwLock::new(HashMap::new())),
      stopped_futures: Arc::new(Mutex::new(Vec::new())),
      download_rate_limiter: if config.download.transmission.enable_speed_limit {
        Some(Limiter::new(
          (config.download.transmission.speed_limit_value as i64 * 1024) as f64,
        ))
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
        match PTaskDesc::load(&task.clone()) {
          Ok(desc) => {
            // Descriptors of already-finished tasks are stale leftovers: they
            // would be re-queued on every launch and re-download files that are
            // already complete. Skip (and clean up) anything terminal.
            if desc.status.is_terminated() {
              let _ = std::fs::remove_file(&task);
              continue;
            }
            let task_id = desc.task_id;
            let task_group = desc.task_group.clone();
            match desc.payload {
              PTaskParam::Download(_) => {
                let task = DownloadTask::from_descriptor(
                  self.app_handle.clone(),
                  desc,
                  Duration::from_secs(1),
                  false,
                );
                let (f, p_handle) = task
                  .future(self.app_handle.clone(), self.download_rate_limiter.clone())
                  .await
                  .unwrap();
                self.enqueue_task(task_id, task_group, f, p_handle).await;
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

  /// True when the given work is already queued or running.
  ///
  /// Any producer of task params can be re-entered while a previous run is
  /// still in flight (instance refresh, modpack import, resource download,
  /// Java install, updater). Without a shared check each one enqueues a fresh
  /// copy of the same files, and the downloads page fills with duplicate groups
  /// that never advance.
  pub fn is_task_pending(&self, param: &PTaskParam) -> bool {
    let key = param.task_key();
    self.phs.read().unwrap().values().any(|h| {
      let desc = h.read().unwrap().desc.clone();
      !desc.status.is_terminated() && desc.payload.task_key() == key
    })
  }

  /// Drop params that duplicate work already in flight, keeping the first of
  /// each key. Returns the filtered list, so callers can also see whether
  /// anything is left to schedule.
  pub fn dedup_pending(&self, params: Vec<PTaskParam>) -> Vec<PTaskParam> {
    let mut seen = std::collections::HashSet::new();
    params
      .into_iter()
      .filter(|p| seen.insert(p.task_key()) && !self.is_task_pending(p))
      .collect()
  }

  pub async fn enqueue_task<T>(
    &self,
    id: u32,
    task_group: Option<String>,
    task: T,
    p_handle: Arc<RwLock<PTaskHandle>>,
  ) where
    T: Future<Output = SJMCLResult<()>> + Send + 'static,
  {
    p_handle.write().unwrap().desc.status = PStatus::Waiting;
    self.phs.write().unwrap().insert(id, p_handle.clone());

    if let Some(ref g) = task_group {
      let mut group_map = self.group_map.write().unwrap();
      if let Some(group) = group_map.get_mut(g) {
        group.phs.insert(id, p_handle.clone());
      } else {
        group_map.insert(
          g.clone(),
          GroupMonitor {
            phs: HashMap::from_iter([(id, p_handle.clone())]),
            status: GEventStatus::Started,
          },
        );
      }
    }

    PEvent::emit_created(
      &self.app_handle,
      id,
      task_group.clone().as_deref(),
      p_handle.read().unwrap().desc.clone(),
    );

    let task = Box::pin(async move {
      if p_handle.read().unwrap().desc.status.is_cancelled() {
        return Ok(());
      }

      let result = task.await;
      let mut p_handle = p_handle.write().unwrap();

      if let Err(e) = result {
        p_handle.mark_failed(e.0);
      }

      Ok(())
    });

    if let Some(ref task_group) = task_group {
      GEvent::emit_group_started(&self.app_handle, task_group);
    }

    self
      .tx
      .send_async(SJMCLFuture {
        task_id: id,
        task_group: task_group.clone(),
        f: task,
      })
      .await
      .unwrap();
  }

  pub async fn enqueue_task_group(&self, task_group: String, futures: Vec<SJMCLFutureDesc>) {
    let mut hvec: Vec<(u32, Arc<RwLock<PTaskHandle>>)> = Vec::new();

    for future in futures.iter() {
      future.h.write().unwrap().desc.status = PStatus::Waiting;
      self
        .phs
        .write()
        .unwrap()
        .insert(future.task_id, future.h.clone());
      PEvent::emit_created(
        &self.app_handle,
        future.task_id,
        Some(task_group.as_ref()),
        future.h.read().unwrap().desc.clone(),
      );
      hvec.push((future.task_id, future.h.clone()));
    }

    self.group_map.write().unwrap().insert(
      task_group.clone(),
      GroupMonitor {
        phs: HashMap::from_iter(hvec),
        status: GEventStatus::Started,
      },
    );
    GEvent::emit_group_started(&self.app_handle, &task_group);

    for future in futures {
      let task = Box::pin(async move {
        if future.h.read().unwrap().desc.status.is_cancelled() {
          return Ok(());
        }
        let result = future.f.await;
        let mut p_handle = future.h.write().unwrap();
        if let Err(e) = result {
          p_handle.mark_failed(e.0);
        }
        Ok(())
      });
      self
        .tx
        .send_async(SJMCLFuture {
          task_id: future.task_id,
          task_group: Some(task_group.clone()),
          f: task,
        })
        .await
        .unwrap();
    }
  }

  pub async fn background_process(&self) {
    loop {
      let future = self.rx.recv_async().await.unwrap();
      if self
        .phs
        .read()
        .unwrap()
        .get(&future.task_id)
        .unwrap()
        .read()
        .unwrap()
        .desc
        .status
        .is_cancelled()
      {
        continue;
      }
      // Check if the task group is stopped before acquiring permit
      if let Some(ref task_group) = future.task_group {
        let is_stopped = self
          .group_map
          .read()
          .unwrap()
          .get(task_group)
          .map(|g| g.status == GEventStatus::Stopped)
          .unwrap_or(false);

        if is_stopped {
          // Store the future in the stopped_futures list and continue to next task
          self.stopped_futures.lock().unwrap().push(future);
          continue;
        }
      }

      // Acquire permit before spawning the task
      let permit = self.concurrency.clone().acquire_owned().await.unwrap();

      let tasks = self.tasks.clone();
      let group_map = self.group_map.clone();
      let app = self.app_handle.clone();
      let phs = Arc::clone(&self.phs);

      self.tasks.lock().unwrap().insert(
        future.task_id,
        tauri::async_runtime::spawn(async move {
          // Move the permit into the spawned task
          let _permit = permit;

          if let Some(task_group) = future.task_group.clone() {
            // Wait for the task group to be resumed if it is stopped
            loop {
              let is_stopped = group_map
                .read()
                .unwrap()
                .get(&task_group)
                .map(|g| g.status == GEventStatus::Stopped)
                .unwrap_or(false);
              if !is_stopped {
                break;
              }
              tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
          }

          let r = future.f.await;
          match r {
            Ok(_) => {
              if let Some(group_name) = future.task_group.clone()
                && let Some(group) = group_map.write().unwrap().get_mut(&group_name)
              {
                // Remove the per-task handle as soon as it finishes so a large
                // modpack (with hundreds of files) doesn't keep every handle in
                // memory for the whole download. The group itself only completes
                // once all its tasks are done.
                group.phs.remove(&future.task_id);
                if group.phs.is_empty() {
                  group.status = GEventStatus::Completed;
                  GEvent::emit_group_completed(&app, &group_name)
                }
              }
            }
            Err(e) => {
              info!("Task failed: {e:?}");
              if let Some(group_name) = future.task_group.clone() {
                GEvent::emit_group_failed(&app, &group_name);
                if let Some(group) = group_map.write().unwrap().remove(&group_name) {
                  for (_, handle) in group.phs {
                    let mut handle = handle.write().unwrap();
                    if handle.desc.status.is_waiting() {
                      handle.mark_cancelled()
                    }
                  }
                }
              }
            }
          }
          // Drop the per-task handle from the global registry so finished tasks
          // don't accumulate in memory for the whole session.
          phs.write().unwrap().remove(&future.task_id);
          tasks.lock().unwrap().remove(&future.task_id);
          // The permit will be automatically released when _permit is dropped
        }),
      );
    }
  }

  pub fn stop_progress(&self, id: u32) {
    if let Some(handle) = self.phs.read().unwrap().get(&id) {
      handle.write().unwrap().mark_stopped();
    }
  }

  pub fn resume_progress(&self, id: u32) {
    if let Some(handle) = self.phs.read().unwrap().get(&id) {
      handle.write().unwrap().mark_resumed();
    }
  }

  pub fn cancel_progress(&self, id: u32) {
    if let Some(p_handle) = self.phs.read().unwrap().get(&id) {
      p_handle.write().unwrap().mark_cancelled();
      if let Some(j_handle) = self.tasks.lock().unwrap().remove(&id) {
        j_handle.abort();
      }
    }
  }

  #[allow(dead_code)]
  pub async fn restart_progress(&self, id: u32) {
    let handle = self.phs.write().unwrap().remove(&id);
    if let Some(handle) = handle {
      let desc = handle.read().unwrap().desc.clone();
      let task_group = desc.task_group.clone();
      let task_state = desc.status.clone();
      let j_handle = self.tasks.lock().unwrap().remove(&id).unwrap();
      if !task_state.is_completed() {
        handle.write().unwrap().mark_cancelled();
        j_handle.abort();
      }
      match desc.payload {
        PTaskParam::Download(_) => {
          let task = DownloadTask::from_descriptor(
            self.app_handle.clone(),
            desc,
            Duration::from_secs(1),
            true,
          );
          let (f, new_h) = task
            .future(self.app_handle.clone(), self.download_rate_limiter.clone())
            .await
            .unwrap();
          self.enqueue_task(id, task_group, f, new_h).await;
        }
      }
    }
  }

  pub fn create_transient_task(&self, app: AppHandle, mut handle: THandle) {
    handle.task_id = self.get_new_id();
    TEvent::new(&handle).emit(&app);
    self.ths.write().unwrap().insert(handle.task_id, handle);
  }

  pub fn set_transient_task(&self, app: AppHandle, task_id: u32, state: String) {
    if let Some(desc) = self.ths.write().unwrap().get_mut(&task_id) {
      desc.state = state;
      TEvent::new(desc).emit(&app);
    }
  }

  pub fn cancel_transient_task(&self, task_id: u32) {
    self.ths.write().unwrap().remove(&task_id);
  }

  pub fn get_transient_task(&self, task_id: u32) -> Option<THandle> {
    self.ths.read().unwrap().get(&task_id).cloned()
  }

  pub fn cancel_progressive_task_group(&self, task_group: String) {
    if let Some(group) = self.group_map.write().unwrap().remove(&task_group) {
      for handle in group.phs.values() {
        handle.write().unwrap().mark_cancelled();
        if let Some(join_handle) = self
          .tasks
          .lock()
          .unwrap()
          .remove(&handle.read().unwrap().desc.task_id)
        {
          join_handle.abort();
        }
      }
      GEvent::emit_group_cancelled(&self.app_handle, &task_group);
    }
  }

  pub fn stop_progressive_task_group(&self, task_group: String) {
    if let Some(group) = self.group_map.write().unwrap().get_mut(&task_group) {
      group.status = GEventStatus::Stopped;
      for handle in group.phs.values() {
        let status = handle.read().unwrap().desc.status.clone();
        if status.is_in_progress() || status.is_waiting() {
          handle.write().unwrap().mark_stopped();
        }
      }
      GEvent::emit_group_stopped(&self.app_handle, &task_group);
    }
  }

  pub async fn resume_progressive_task_group(&self, task_group: String) {
    if let Some(group) = self.group_map.write().unwrap().get_mut(&task_group) {
      group.status = GEventStatus::Started;

      // Resume existing stopped tasks
      for handle in group.phs.values() {
        if handle.read().unwrap().desc.status.is_stopped() {
          handle.write().unwrap().mark_resumed();
        }
      }
    }

    // Re-send all stored stopped futures for this task group
    let futures_to_resend = {
      let mut stopped_futures = self.stopped_futures.lock().unwrap();
      let mut futures = Vec::new();

      // Extract futures that belong to this task group
      let mut i = 0;
      while i < stopped_futures.len() {
        if stopped_futures[i].task_group.as_ref() == Some(&task_group) {
          futures.push(stopped_futures.remove(i));
        } else {
          i += 1;
        }
      }

      futures
    };

    // Re-send the futures
    for future in futures_to_resend {
      self.tx.send_async(future).await.unwrap();
    }

    GEvent::emit_group_started(&self.app_handle, &task_group);
  }

  pub fn delete_progressive_task_group(&self, task_group: String) {
    let mut group_map = self.group_map.write().unwrap();
    if let Some(group) = group_map.get(&task_group) {
      // Only delete non-active groups (not Started/Stopped); backend status is authoritative for race-condition protection.
      if group.status != GEventStatus::Started && group.status != GEventStatus::Stopped {
        group_map.remove(&task_group);
      }
    }
  }

  pub fn state_list(&self) -> Vec<PTaskGroupDesc> {
    self
      .group_map
      .read()
      .unwrap()
      .iter()
      .map(|(k, v)| PTaskGroupDesc {
        task_group: k.clone(),
        task_descs: v
          .phs
          .values()
          .map(|h| h.read().unwrap().desc.clone())
          .collect(),
        status: v.status.clone(),
      })
      .collect()
  }

  pub fn has_active_download_tasks(&self) -> bool {
    let phs = self.phs.read().unwrap();
    for handle in phs.values() {
      let desc = handle.read().unwrap();
      let status = &desc.desc.status;
      // check if the task is a download task and is in progress or waiting
      if matches!(desc.desc.payload, PTaskParam::Download(_))
        && (status.is_in_progress() || status.is_waiting())
      {
        return true;
      }
    }
    false
  }
}
