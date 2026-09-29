use rmcp::handler::server::tool::ToolRoute;
use sjmcl_downloader::{EngineHandle, Task, TaskState};
use sjmcl_types::error::SJMCLError;
use std::path::PathBuf;
use tauri::{Manager, Url};

use crate::download::{DownloadTask, submit_download_group};
use crate::intelligence::mcp_server::launcher::McpContext;
use crate::intelligence::mcp_server::model::MCPError;
use crate::mcp_tool;

fn engine_error(error: sjmcl_downloader::EngineError) -> SJMCLError {
  SJMCLError(error.to_string())
}

fn progress_units(task: &Task) -> u64 {
  match task.state {
    TaskState::Done => 1000,
    TaskState::Downloading | TaskState::Verifying if task.total > 0 => {
      ((task.received.min(task.total) as u128 * 1000) / task.total as u128) as u64
    }
    _ => 0,
  }
}

fn active_phase(tasks: &[Task]) -> &'static str {
  for (executor, phase) in [
    ("verify", "verify"),
    ("install", "install"),
    ("prepare_install", "prepare"),
  ] {
    if tasks.iter().any(|task| {
      task.executor == executor
        && matches!(task.state, TaskState::Downloading | TaskState::Verifying)
    }) {
      return phase;
    }
  }
  if tasks.iter().any(|task| {
    task.executor == "download"
      && matches!(task.state, TaskState::Downloading | TaskState::Verifying)
  }) {
    "download"
  } else {
    "waiting"
  }
}

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![
    mcp_tool!(
      "submit_download",
      "Schedule an HTTP(S) file download to an exact destination file path and return its group ID. Requires confirm=true.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "HTTP(S) URL of the file to download.")]
        url: String,
        #[schemars(description = "Exact destination file path. Parent directories are created by the downloader.")]
        dest: String,
        #[schemars(description = "Optional expected SHA-1 checksum.")]
        sha1: Option<String>,
        #[schemars(description = "Must be true to confirm writing the downloaded file.")]
        confirm: bool,
      } => async move {
        if !params.confirm {
          return Err(MCPError::ToolNeedsConfirmation.into());
        }
        let url = Url::parse(&params.url).map_err(|error| SJMCLError(error.to_string()))?;
        if !matches!(url.scheme(), "http" | "https") || params.dest.trim().is_empty() {
          return Err(SJMCLError("invalid download URL or destination".into()));
        }
        let dest = PathBuf::from(params.dest);
        let name = dest
          .file_name()
          .map(|name| name.to_string_lossy().into_owned())
          .unwrap_or_else(|| dest.to_string_lossy().into_owned());
        submit_download_group(
          app,
          format!("file-download?{name}"),
          vec![DownloadTask {
            src: url,
            dest,
            filename: None,
            sha1: params.sha1,
          }],
          true,
        )
        .await
      }
    ),
    mcp_tool!(
      "retrieve_download_groups",
      "Retrieve download and installation task groups, including their progress and final result.",
      |app, _params: rmcp::model::JsonObject| async move {
        app
          .state::<EngineHandle>()
          .0
          .snapshot()
          .await
          .map_err(|error| SJMCLError(error.to_string()))
      }
    ),
    mcp_tool!(
      "retrieve_download_tasks",
      "Retrieve task details and errors for a download or installation group.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        group_id: String,
      } => async move {
        app
          .state::<EngineHandle>()
          .0
          .list_tasks(params.group_id)
          .await
          .map_err(|error| SJMCLError(error.to_string()))
      }
    ),
    mcp_tool!(
      "retrieve_download_progress",
      "Retrieve compact byte and task progress for one download or installation group. Poll this instead of retrieving all tasks for a progress display.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Task group ID returned by `submit_download` or `create_instance`.")]
        group_id: String,
      } => async move {
        let tasks = app
          .state::<EngineHandle>()
          .0
          .list_tasks(params.group_id.clone())
          .await
          .map_err(engine_error)?;
        let downloads: Vec<_> = tasks
          .iter()
          .filter(|task| task.executor == "download")
          .collect();
        let received_bytes = downloads
          .iter()
          .fold(0u64, |sum, task| sum.saturating_add(task.received));
        let known_total_bytes = downloads
          .iter()
          .fold(0u64, |sum, task| sum.saturating_add(task.total));
        Ok(serde_json::json!({
          "groupId": params.group_id,
          "progressUnits": tasks.iter().map(progress_units).sum::<u64>(),
          "totalUnits": (tasks.len() as u64).saturating_mul(1000),
          "receivedBytes": received_bytes,
          "knownTotalBytes": known_total_bytes,
          "allTotalsKnown": downloads.iter().all(|task| task.total > 0),
          "phase": active_phase(&tasks),
        }))
      }
    ),
    mcp_tool!(
      "pause_download_group",
      "Pause an active download or installation group.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        group_id: String,
      } => async move {
        app.state::<EngineHandle>().0.pause(params.group_id).await.map_err(engine_error)
      }
    ),
    mcp_tool!(
      "resume_download_group",
      "Resume a paused download or installation group.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        group_id: String,
      } => async move {
        app.state::<EngineHandle>().0.resume(params.group_id).await.map_err(engine_error)
      }
    ),
    mcp_tool!(
      "retry_download_group",
      "Retry a failed download or installation group.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        group_id: String,
      } => async move {
        app.state::<EngineHandle>().0.retry(params.group_id).await.map_err(engine_error)
      }
    ),
    mcp_tool!(
      "cancel_download_group",
      "Cancel a download or installation group. Requires confirm=true.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        group_id: String,
        confirm: bool,
      } => async move {
        if !params.confirm {
          return Err(MCPError::ToolNeedsConfirmation.into());
        }
        app.state::<EngineHandle>().0.cancel(params.group_id).await.map_err(engine_error)
      }
    ),
    mcp_tool!(
      "remove_download_group",
      "Remove a finished group from download history. Requires confirm=true.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        group_id: String,
        confirm: bool,
      } => async move {
        if !params.confirm {
          return Err(MCPError::ToolNeedsConfirmation.into());
        }
        app.state::<EngineHandle>().0.remove(params.group_id).await.map_err(engine_error)
      }
    ),
  ]
}
