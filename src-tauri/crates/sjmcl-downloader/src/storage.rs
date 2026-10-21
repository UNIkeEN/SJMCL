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
                 auto_resume INTEGER NOT NULL DEFAULT 0,
                 state TEXT NOT NULL,
                 finish TEXT,
                 completion_pending INTEGER NOT NULL DEFAULT 0,
                 finished_at INTEGER,
                 tasks_json TEXT NOT NULL
             );",
      )
      .map_err(|e| e.to_string())?;
    // Support older databases; a duplicate-column error means this migration already ran.
    let _ = conn.execute(
      "ALTER TABLE groups ADD COLUMN auto_resume INTEGER NOT NULL DEFAULT 0",
      [],
    );
    // Existing history has no acknowledgement record and must not be replayed.
    let _ = conn.execute(
      "ALTER TABLE groups ADD COLUMN completion_pending INTEGER NOT NULL DEFAULT 0",
      [],
    );
    let _ = conn.execute("ALTER TABLE groups ADD COLUMN finished_at INTEGER", []);
    // Legacy history has no reliable age. Start its retention period at this upgrade.
    conn
      .execute(
        "UPDATE groups SET finished_at = unixepoch()
         WHERE state = '\"finished\"' AND finished_at IS NULL",
        [],
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
            "INSERT INTO groups (id, name, auto_resume, state, finish, tasks_json, completion_pending, finished_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CASE WHEN ?4 = '\"finished\"' THEN unixepoch() END)
             ON CONFLICT(id) DO UPDATE SET
                 name=excluded.name, auto_resume=excluded.auto_resume, state=excluded.state,
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
                g.completion_pending
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
        "SELECT id, name, auto_resume, state, finish, tasks_json, completion_pending FROM groups",
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
        ))
      })
      .map_err(|e| e.to_string())?;
    let mut groups = Vec::new();
    for row in rows {
      let (id, mut name, mut auto_resume, state, finish, tasks_json, completion_pending) =
        row.map_err(|e| e.to_string())?;
      // Version 0.1 encoded auto_resume in the name prefix; restore the real field on load.
      if !auto_resume && let Some(original) = name.strip_prefix("[auto]") {
        name = original.to_string();
        auto_resume = true;
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

#[cfg(test)]
mod tests {
  use crate::storage::{SqliteStore, StateStore};
  use crate::{FinishKind, GroupState, SubmitTask, Task, TaskGroup, TaskState};

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
    assert!(!groups[0].completion_pending);
  }

  #[test]
  fn does_not_replay_completed_history_from_before_completion_tracking() {
    let db = TempDb::new();
    let conn = rusqlite::Connection::open(&db.0).unwrap();
    conn.execute_batch(
      "CREATE TABLE groups (id TEXT PRIMARY KEY, name TEXT NOT NULL,
       auto_resume INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, finish TEXT, tasks_json TEXT NOT NULL);
       INSERT INTO groups VALUES ('g1', 'modpack?old', 1, '\"finished\"', '\"completed\"', '[]');"
    ).unwrap();
    drop(conn);
    let store = SqliteStore::open(&db.0).unwrap();
    let group = store.load_all().unwrap().remove(0);
    assert_eq!(group.finish, Some(crate::FinishKind::Completed));
    assert!(!group.completion_pending);
  }

  #[test]
  fn startup_prunes_expired_finished_history_but_preserves_unfinished_work() {
    let db = TempDb::new();
    let store = SqliteStore::open(&db.0).unwrap();
    for (id, state, finish, pending) in [
      (
        "completed",
        GroupState::Finished,
        Some(FinishKind::Completed),
        false,
      ),
      (
        "cancelled",
        GroupState::Finished,
        Some(FinishKind::Cancelled),
        false,
      ),
      (
        "failed",
        GroupState::Finished,
        Some(FinishKind::Failed),
        false,
      ),
      (
        "recent",
        GroupState::Finished,
        Some(FinishKind::Completed),
        false,
      ),
      (
        "completion-pending",
        GroupState::Finished,
        Some(FinishKind::Completed),
        true,
      ),
      ("active", GroupState::Active, None, false),
      ("queued", GroupState::Queued, None, false),
      ("paused", GroupState::Paused, None, false),
      ("draining", GroupState::Draining, None, false),
      ("without-outcome", GroupState::Finished, None, false),
    ] {
      store
        .save_group(&TaskGroup {
          id: id.into(),
          name: id.into(),
          auto_resume: true,
          state,
          finish,
          completion_pending: pending,
          tasks: Vec::new(),
        })
        .unwrap();
    }
    // Make all rows old except one finished less than 30 days ago.
    store
      .conn
      .lock()
      .unwrap()
      .execute(
        "UPDATE groups SET finished_at = CASE WHEN id = 'recent'
       THEN unixepoch() - 29 * 24 * 60 * 60 ELSE 1 END",
        [],
      )
      .unwrap();
    drop(store);

    let store = SqliteStore::open(&db.0).unwrap();
    let mut retained: Vec<_> = store
      .load_all()
      .unwrap()
      .into_iter()
      .map(|g| g.id)
      .collect();
    retained.sort();
    assert_eq!(
      retained,
      [
        "active",
        "completion-pending",
        "draining",
        "paused",
        "queued",
        "recent",
        "without-outcome"
      ]
    );
    drop(store);
    assert_eq!(
      SqliteStore::open(&db.0).unwrap().load_all().unwrap().len(),
      7
    );
  }

  #[test]
  fn finished_time_survives_repeated_saves_and_restarts_but_resets_on_retry() {
    let db = TempDb::new();
    let store = SqliteStore::open(&db.0).unwrap();
    let mut group = TaskGroup {
      id: "g1".into(),
      name: "retry".into(),
      auto_resume: true,
      state: GroupState::Finished,
      finish: Some(FinishKind::Failed),
      completion_pending: false,
      tasks: Vec::new(),
    };
    store.save_group(&group).unwrap();
    store
      .conn
      .lock()
      .unwrap()
      .execute(
        "UPDATE groups SET finished_at = unixepoch() - 29 * 24 * 60 * 60",
        [],
      )
      .unwrap();
    let finished_at: i64 = store
      .conn
      .lock()
      .unwrap()
      .query_row(
        "SELECT finished_at FROM groups WHERE id = 'g1'",
        [],
        |row| row.get(0),
      )
      .unwrap();
    store.save_group(&group).unwrap();
    drop(store);

    let store = SqliteStore::open(&db.0).unwrap();
    assert_eq!(
      store
        .conn
        .lock()
        .unwrap()
        .query_row(
          "SELECT finished_at FROM groups WHERE id = 'g1'",
          [],
          |row| row.get::<_, i64>(0),
        )
        .unwrap(),
      finished_at
    );
    group.state = GroupState::Queued;
    group.finish = None;
    store.save_group(&group).unwrap();
    assert_eq!(
      store
        .conn
        .lock()
        .unwrap()
        .query_row(
          "SELECT finished_at FROM groups WHERE id = 'g1'",
          [],
          |row| row.get::<_, Option<i64>>(0),
        )
        .unwrap(),
      None
    );
    group.state = GroupState::Finished;
    group.finish = Some(FinishKind::Completed);
    store.save_group(&group).unwrap();
    assert!(
      store
        .conn
        .lock()
        .unwrap()
        .query_row(
          "SELECT finished_at FROM groups WHERE id = 'g1'",
          [],
          |row| row.get::<_, i64>(0),
        )
        .unwrap()
        > finished_at
    );
  }

  #[test]
  fn legacy_history_starts_retention_at_upgrade() {
    let db = TempDb::new();
    let conn = rusqlite::Connection::open(&db.0).unwrap();
    conn
      .execute_batch(
        "CREATE TABLE groups (id TEXT PRIMARY KEY, name TEXT NOT NULL,
       auto_resume INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, finish TEXT,
       completion_pending INTEGER NOT NULL DEFAULT 0, tasks_json TEXT NOT NULL);
       INSERT INTO groups VALUES ('g1', 'old', 1, '\"finished\"', '\"completed\"', 0, '[]');
       INSERT INTO groups VALUES ('g2', 'paused', 1, '\"paused\"', NULL, 0, '[]');",
      )
      .unwrap();
    let upgrade_time: i64 = conn
      .query_row("SELECT unixepoch()", [], |row| row.get(0))
      .unwrap();
    drop(conn);

    let store = SqliteStore::open(&db.0).unwrap();
    assert_eq!(store.load_all().unwrap().len(), 2);
    let finished_at: i64 = store
      .conn
      .lock()
      .unwrap()
      .query_row(
        "SELECT finished_at FROM groups WHERE id = 'g1'",
        [],
        |row| row.get(0),
      )
      .unwrap();
    assert!(finished_at >= upgrade_time);
    assert_eq!(
      store
        .conn
        .lock()
        .unwrap()
        .query_row(
          "SELECT finished_at FROM groups WHERE id = 'g2'",
          [],
          |row| row.get::<_, Option<i64>>(0),
        )
        .unwrap(),
      None
    );
  }
}
