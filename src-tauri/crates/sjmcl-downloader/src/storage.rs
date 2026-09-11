//! State persistence behind a trait, with SQLite by default and an in-memory test implementation.
//!
//! Writes occur only at state transitions and other key points. The `.part` file size is the
//! offset and can be read when resuming, so it does not need frequent persistence.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::model::{GroupState, Task, TaskGroup, TaskState};

pub trait StateStore: Send + Sync {
  fn save_group(&self, g: &TaskGroup) -> Result<(), String>;
  fn save_task(&self, t: &Task) -> Result<(), String>;
  fn load_all(&self) -> Result<Vec<TaskGroup>, String>;
  fn remove_group(&self, group_id: &str) -> Result<(), String>;
}

/// In-memory implementation for tests and non-persistent use.
#[derive(Default)]
pub struct MemoryStore {
  groups: Mutex<Vec<TaskGroup>>,
}

impl StateStore for MemoryStore {
  fn save_group(&self, g: &TaskGroup) -> Result<(), String> {
    let mut groups = self.groups.lock().unwrap();
    if let Some(existing) = groups.iter_mut().find(|x| x.id == g.id) {
      *existing = g.clone();
    } else {
      groups.push(g.clone());
    }
    Ok(())
  }

  fn save_task(&self, t: &Task) -> Result<(), String> {
    let mut groups = self.groups.lock().unwrap();
    for g in groups.iter_mut() {
      if g.id == t.group_id {
        if let Some(task) = g.task_mut(&t.id) {
          *task = t.clone();
        }
        return Ok(());
      }
    }
    Err("group not found".into())
  }

  fn load_all(&self) -> Result<Vec<TaskGroup>, String> {
    Ok(self.groups.lock().unwrap().clone())
  }

  fn remove_group(&self, group_id: &str) -> Result<(), String> {
    self.groups.lock().unwrap().retain(|g| g.id != group_id);
    Ok(())
  }
}

/// SQLite implementation using one mutex-protected connection for small transactions.
pub struct SqliteStore {
  conn: Mutex<Connection>,
}

impl SqliteStore {
  pub fn open(path: &Path) -> Result<Self, String> {
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn
      .execute_batch(
        "PRAGMA journal_mode=WAL;
             CREATE TABLE IF NOT EXISTS groups (
                 id TEXT PRIMARY KEY,
                 name TEXT NOT NULL,
                 auto_resume INTEGER NOT NULL DEFAULT 0,
                 state TEXT NOT NULL,
                 finish TEXT,
                 tasks_json TEXT NOT NULL
             );",
      )
      .map_err(|e| e.to_string())?;
    // Support older databases; a duplicate-column error means the migration already ran.
    let _ = conn.execute(
      "ALTER TABLE groups ADD COLUMN auto_resume INTEGER NOT NULL DEFAULT 0",
      [],
    );
    Ok(SqliteStore {
      conn: Mutex::new(conn),
    })
  }
}

impl StateStore for SqliteStore {
  fn save_group(&self, g: &TaskGroup) -> Result<(), String> {
    let tasks_json = serde_json::to_string(&g.tasks).map_err(|e| e.to_string())?;
    let finish = g
      .finish
      .map(|f| serde_json::to_string(&f).unwrap())
      .unwrap_or_default();
    let finish = if finish.is_empty() {
      None
    } else {
      Some(finish)
    };
    let conn = self.conn.lock().unwrap();
    conn.execute(
            "INSERT INTO groups (id, name, auto_resume, state, finish, tasks_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                 name=excluded.name, auto_resume=excluded.auto_resume, state=excluded.state,
                 finish=excluded.finish, tasks_json=excluded.tasks_json",
            rusqlite::params![
                g.id,
                g.name,
                g.auto_resume,
                serde_json::to_string(&g.state).unwrap(),
                finish,
                tasks_json
            ],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
  }

  fn save_task(&self, t: &Task) -> Result<(), String> {
    let conn = self.conn.lock().unwrap();
    let mut stmt = conn
      .prepare("SELECT tasks_json FROM groups WHERE id = ?1")
      .map_err(|e| e.to_string())?;
    let json: String = stmt
      .query_row([&t.group_id], |r| r.get(0))
      .map_err(|e| e.to_string())?;
    drop(stmt);
    let mut tasks: Vec<Task> = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    if let Some(task) = tasks.iter_mut().find(|x| x.id == t.id) {
      *task = t.clone();
    } else {
      tasks.push(t.clone());
    }
    let tasks_json = serde_json::to_string(&tasks).map_err(|e| e.to_string())?;
    conn
      .execute(
        "UPDATE groups SET tasks_json = ?1 WHERE id = ?2",
        rusqlite::params![tasks_json, t.group_id],
      )
      .map_err(|e| e.to_string())?;
    Ok(())
  }

  fn load_all(&self) -> Result<Vec<TaskGroup>, String> {
    let conn = self.conn.lock().unwrap();
    let mut stmt = conn
      .prepare("SELECT id, name, auto_resume, state, finish, tasks_json FROM groups")
      .map_err(|e| e.to_string())?;
    let rows = stmt
      .query_map([], |r| {
        Ok((
          r.get::<_, String>(0)?,
          r.get::<_, String>(1)?,
          r.get::<_, bool>(2)?,
          r.get::<_, String>(3)?,
          r.get::<_, Option<String>>(4)?,
          r.get::<_, String>(5)?,
        ))
      })
      .map_err(|e| e.to_string())?;
    let mut groups = Vec::new();
    for row in rows {
      let (id, mut name, mut auto_resume, state, finish, tasks_json) =
        row.map_err(|e| e.to_string())?;
      // Version 0.1 temporarily stored auto_resume in a name prefix. Restore the actual field.
      if !auto_resume {
        if let Some(original) = name.strip_prefix("[auto]") {
          name = original.to_string();
          auto_resume = true;
        }
      }
      let tasks: Vec<Task> = serde_json::from_str(&tasks_json).map_err(|e| e.to_string())?;
      let state: GroupState = serde_json::from_str(&state).map_err(|e| e.to_string())?;
      let finish: Option<crate::model::FinishKind> = finish
        .map(|f| serde_json::from_str(&f).map_err(|e: serde_json::Error| e.to_string()))
        .transpose()?;
      groups.push(TaskGroup {
        id,
        name,
        auto_resume,
        state,
        finish,
        tasks,
      });
    }
    Ok(groups)
  }

  fn remove_group(&self, group_id: &str) -> Result<(), String> {
    let conn = self.conn.lock().unwrap();
    conn
      .execute("DELETE FROM groups WHERE id = ?1", [group_id])
      .map_err(|e| e.to_string())?;
    Ok(())
  }
}

/// Restores regular groups as Paused after a restart. Groups with `auto_resume` that were active
/// or queued before a crash are restored as Queued for the actor to reactivate within its limit.
pub fn reconcile_after_restart(groups: &mut [TaskGroup]) {
  for g in groups.iter_mut() {
    let can_auto_resume =
      g.auto_resume && matches!(g.state, GroupState::Active | GroupState::Queued);
    if matches!(
      g.state,
      GroupState::Active | GroupState::Draining | GroupState::Queued
    ) {
      g.state = if can_auto_resume {
        GroupState::Queued
      } else {
        GroupState::Paused
      };
      for t in g.tasks.iter_mut() {
        let interrupted_retry = t.state == TaskState::Failed && !t.retries_exhausted;
        if !t.state.is_terminal() || interrupted_retry {
          t.state = if can_auto_resume {
            TaskState::Pending
          } else {
            TaskState::Paused
          };
        }
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use super::{SqliteStore, StateStore};
  use crate::{GroupState, SubmitTask, Task, TaskState};

  struct TempDb(std::path::PathBuf);

  impl TempDb {
    fn new() -> Self {
      static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
      let n = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
      TempDb(std::env::temp_dir().join(format!(
        "sjmcl-downloader-migration-{}-{n}.db",
        std::process::id()
      )))
    }
  }

  impl Drop for TempDb {
    fn drop(&mut self) {
      let _ = std::fs::remove_file(&self.0);
      let _ = std::fs::remove_file(format!("{}-wal", self.0.display()));
      let _ = std::fs::remove_file(format!("{}-shm", self.0.display()));
    }
  }

  #[test]
  fn migrates_legacy_group_and_task_fields() {
    let db = TempDb::new();
    let conn = rusqlite::Connection::open(&db.0).unwrap();
    conn
      .execute_batch(
        "CREATE TABLE groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                state TEXT NOT NULL,
                finish TEXT,
                tasks_json TEXT NOT NULL
            );",
      )
      .unwrap();
    let submit = SubmitTask {
      name: "legacy".into(),
      executor: "download".into(),
      spec: serde_json::json!({ "url": "http://localhost/file" }),
      dest: Some(std::env::temp_dir().join("legacy.bin")),
      sha1: None,
      sha256: None,
    };
    let mut task = Task::new("t2".into(), "g1".into(), &submit);
    task.state = TaskState::Downloading;
    let mut legacy_task = serde_json::to_value(task).unwrap();
    let task_fields = legacy_task.as_object_mut().unwrap();
    let group_id = task_fields.remove("groupId").unwrap();
    task_fields.insert("group_id".into(), group_id);
    let retries_exhausted = task_fields.remove("retriesExhausted").unwrap();
    task_fields.insert("retries_exhausted".into(), retries_exhausted);
    task_fields.remove("sha1");
    conn
      .execute(
        "INSERT INTO groups (id, name, state, finish, tasks_json)
             VALUES (?1, ?2, ?3, NULL, ?4)",
        rusqlite::params![
          "g1",
          "[auto]legacy",
          serde_json::to_string(&GroupState::Active).unwrap(),
          serde_json::to_string(&vec![legacy_task]).unwrap()
        ],
      )
      .unwrap();
    drop(conn);

    let store = SqliteStore::open(&db.0).unwrap();
    let groups = store.load_all().unwrap();
    assert_eq!(groups[0].name, "legacy");
    assert!(groups[0].auto_resume);
    assert_eq!(groups[0].tasks[0].group_id, "g1");
    assert_eq!(groups[0].tasks[0].sha1, None);
  }
}
