//! State persistence. SQLite is the default implementation; tests can use memory storage.
//!
//! Persist state transitions and key milestones. On resume, the partial file size
//! is the authoritative offset, so progress does not need frequent database writes.

use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use rusqlite::Connection;

use crate::model::{GroupState, Task, TaskGroup, TaskState};

/// Shared retention period for download history and the launcher's download cache.
pub const DOWNLOAD_HISTORY_RETENTION: Duration = Duration::from_secs(30 * 24 * 60 * 60);

pub trait StateStore: Send + Sync {
  fn save_group(&self, g: &TaskGroup) -> Result<(), String>;
  fn save_task(&self, t: &Task) -> Result<(), String>;
  fn load_all(&self) -> Result<Vec<TaskGroup>, String>;
  fn remove_group(&self, group_id: &str) -> Result<(), String>;
}

/// In-memory store for tests or sessions without persistence.
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

/// SQLite store with one mutex-protected connection; task updates rewrite the group's JSON row.
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
                 parent_group_id TEXT,
                 auto_resume INTEGER NOT NULL DEFAULT 0,
                 state TEXT NOT NULL,
                 finish TEXT,
                 completion_pending INTEGER NOT NULL DEFAULT 0,
                 finished_at INTEGER,
                 tasks_json TEXT NOT NULL
             );",
      )
      .map_err(|e| e.to_string())?;
    // Prune before the engine restores groups, so expired failures cannot reappear in memory.
    conn
      .execute(
        "DELETE FROM groups WHERE state = '\"finished\"' AND finish IS NOT NULL
         AND completion_pending = 0 AND finished_at < unixepoch() - ?1",
        [DOWNLOAD_HISTORY_RETENTION.as_secs()],
      )
      .map_err(|e| e.to_string())?;
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
            "INSERT INTO groups (id, name, auto_resume, state, finish, tasks_json, completion_pending, finished_at, parent_group_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CASE WHEN ?4 = '\"finished\"' THEN unixepoch() END, ?8)
             ON CONFLICT(id) DO UPDATE SET
                 name=excluded.name, auto_resume=excluded.auto_resume, state=excluded.state,
                 parent_group_id=excluded.parent_group_id,
                 finish=excluded.finish, tasks_json=excluded.tasks_json,
                 completion_pending=excluded.completion_pending,
                 finished_at=CASE WHEN excluded.state = '\"finished\"'
                   THEN COALESCE(groups.finished_at, excluded.finished_at) END",
            rusqlite::params![
                g.id,
                g.name,
                g.auto_resume,
                serde_json::to_string(&g.state).unwrap(),
                finish,
                tasks_json,
                g.completion_pending,
                g.parent_group_id
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
      .prepare(
        "SELECT id, name, auto_resume, state, finish, tasks_json, completion_pending, parent_group_id FROM groups",
      )
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
          r.get::<_, bool>(6)?,
          r.get::<_, Option<String>>(7)?,
        ))
      })
      .map_err(|e| e.to_string())?;
    let mut groups = Vec::new();
    for row in rows {
      let (id, name, auto_resume, state, finish, tasks_json, completion_pending, parent_group_id) =
        row.map_err(|e| e.to_string())?;
      let tasks: Vec<Task> = serde_json::from_str(&tasks_json).map_err(|e| e.to_string())?;
      let state: GroupState = serde_json::from_str(&state).map_err(|e| e.to_string())?;
      let finish: Option<crate::model::FinishKind> = finish
        .map(|f| serde_json::from_str(&f).map_err(|e: serde_json::Error| e.to_string()))
        .transpose()?;
      groups.push(TaskGroup {
        id,
        name,
        parent_group_id,
        auto_resume,
        state,
        finish,
        completion_pending,
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

/// After restart, ordinary unfinished groups become Paused. Groups with auto_resume
/// that were Active or Queued become Queued and are reactivated subject to the group limit.
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
