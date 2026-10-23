//! Serialize database work off the actor, coalescing pending snapshots by group ID.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, mpsc};

use tokio::sync::oneshot;

use crate::storage::StateStore;
use crate::{EngineError, TaskGroup};

enum Write {
  Save(TaskGroup),
  Remove,
}

type WriteReply = oneshot::Sender<Result<(), String>>;

#[derive(Default)]
struct Pending {
  writes: HashMap<String, (Write, Vec<WriteReply>)>,
  failed: HashSet<String>,
}

pub(crate) struct Persistence {
  pending: Arc<Mutex<Pending>>,
  wake: mpsc::SyncSender<()>,
}

impl Persistence {
  pub fn new(store: Arc<dyn StateStore>) -> Self {
    let pending = Arc::new(Mutex::new(Pending::default()));
    let worker_pending = pending.clone();
    let (wake, receiver) = mpsc::sync_channel(1);
    std::thread::Builder::new()
      .name("download-state".into())
      .spawn(move || {
        loop {
          let connected = receiver.recv().is_ok();
          let writes = std::mem::take(&mut worker_pending.lock().unwrap().writes);
          for (id, (write, replies)) in writes {
            let is_save = matches!(write, Write::Save(_));
            let result = match write {
              Write::Save(group) => store.save_group(&group),
              Write::Remove => store.remove_group(&id),
            };
            let mut pending = worker_pending.lock().unwrap();
            if result.is_err() && is_save {
              pending.failed.insert(id.clone());
            } else {
              pending.failed.remove(&id);
            }
            drop(pending);
            if let Err(error) = &result {
              tracing::warn!("persist download group {id} failed: {error}");
            }
            for reply in replies {
              let _ = reply.send(result.clone());
            }
          }
          if !connected {
            break;
          }
        }
      })
      .expect("failed to start download persistence thread");
    Self { pending, wake }
  }

  fn enqueue(
    &self,
    id: String,
    write: Write,
    reply: Option<WriteReply>,
  ) -> Result<(), EngineError> {
    let mut pending = self.pending.lock().unwrap();
    let entry = pending
      .writes
      .entry(id)
      .or_insert_with(|| (Write::Remove, Vec::new()));
    entry.0 = write;
    entry.1.extend(reply);
    drop(pending);
    match self.wake.try_send(()) {
      Ok(()) | Err(mpsc::TrySendError::Full(())) => Ok(()),
      Err(mpsc::TrySendError::Disconnected(())) => Err(EngineError::ChannelClosed),
    }
  }

  pub fn schedule(&self, group: TaskGroup) {
    if let Err(error) = self.enqueue(group.id.clone(), Write::Save(group), None) {
      tracing::warn!("schedule download persistence failed: {error}");
    }
  }

  pub async fn save(&self, group: TaskGroup) -> Result<(), EngineError> {
    let (reply, result) = oneshot::channel();
    self.enqueue(group.id.clone(), Write::Save(group), Some(reply))?;
    result
      .await
      .map_err(|_| EngineError::ChannelClosed)?
      .map_err(|details| EngineError::Storage { details })
  }

  pub async fn remove(&self, id: &str) -> Result<(), EngineError> {
    let (reply, result) = oneshot::channel();
    self.enqueue(id.into(), Write::Remove, Some(reply))?;
    result
      .await
      .map_err(|_| EngineError::ChannelClosed)?
      .map_err(|details| EngineError::Storage { details })
  }

  pub fn take_failed(&self) -> HashSet<String> {
    std::mem::take(&mut self.pending.lock().unwrap().failed)
  }
}
