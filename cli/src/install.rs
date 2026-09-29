use std::collections::HashMap;
use std::io::{self, IsTerminal};
use std::time::Duration;
use std::time::Instant;

use comfy_table::{ContentArrangement, Table, presets::UTF8_FULL_CONDENSED};
use indicatif::{MultiProgress, ProgressBar, ProgressDrawTarget, ProgressStyle};
use rmcp::model::CallToolRequestParams;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use tokio::time::sleep;

use crate::{LauncherClient, service_error_to_string, with_spinner};

const PROGRESS_TEMPLATE: &str =
  "{spinner:.cyan} {msg:.bold} [{wide_bar:.cyan/blue}] {percent:>3}% {prefix}";

pub struct InstallOptions {
  game_version: String,
  name: String,
  directory_name: Option<String>,
  loader_type: Option<String>,
  loader_version: Option<String>,
  optifine_version: Option<String>,
  wait: bool,
}

pub struct FileDownloadOptions {
  url: String,
  dest: String,
  sha1: Option<String>,
  wait: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LauncherConfig {
  local_game_directories: Vec<GameDirectory>,
}

#[derive(Deserialize)]
struct GameDirectory {
  name: String,
  dir: String,
}

#[derive(Deserialize)]
struct Items<T> {
  items: Vec<T>,
}

#[derive(Deserialize)]
struct DownloadGroup {
  id: String,
  name: String,
  state: String,
  finish: Option<String>,
  stats: DownloadStats,
}

#[derive(Deserialize)]
struct DownloadStats {
  total: usize,
  done: usize,
}

#[derive(Deserialize)]
struct DownloadTask {
  name: String,
  state: String,
  error: Option<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
  group_id: String,
  progress_units: u64,
  total_units: u64,
  received_bytes: u64,
  known_total_bytes: u64,
  all_totals_known: bool,
  phase: String,
}

struct GroupBar {
  bar: ProgressBar,
  previous_bytes: u64,
  previous_at: Instant,
}

struct ProgressDisplay {
  multi: Option<MultiProgress>,
  bars: HashMap<String, GroupBar>,
  summaries: HashMap<String, String>,
}

impl ProgressDisplay {
  fn new() -> Self {
    Self {
      multi: io::stderr()
        .is_terminal()
        .then(|| MultiProgress::with_draw_target(ProgressDrawTarget::stderr())),
      bars: HashMap::new(),
      summaries: HashMap::new(),
    }
  }

  fn update(&mut self, group: &DownloadGroup, progress: Option<&DownloadProgress>) {
    if let Some(multi) = &self.multi {
      let progress = progress.expect("terminal progress requires a snapshot");
      let now = Instant::now();
      let group_bar = self.bars.entry(group.id.clone()).or_insert_with(|| {
        let bar = multi.add(ProgressBar::new(progress.total_units.max(1)));
        bar.set_style(
          ProgressStyle::with_template(PROGRESS_TEMPLATE).expect("valid progress bar style"),
        );
        bar.enable_steady_tick(Duration::from_millis(80));
        GroupBar {
          bar,
          previous_bytes: progress.received_bytes,
          previous_at: now,
        }
      });
      let elapsed = now.duration_since(group_bar.previous_at).as_secs_f64();
      let speed = if elapsed > 0.0 {
        (progress
          .received_bytes
          .saturating_sub(group_bar.previous_bytes) as f64
          / elapsed) as u64
      } else {
        0
      };
      group_bar.previous_bytes = progress.received_bytes;
      group_bar.previous_at = now;
      group_bar.bar.set_length(progress.total_units.max(1));
      group_bar
        .bar
        .set_position(progress.progress_units.min(progress.total_units.max(1)));
      group_bar.bar.set_message(format!(
        "{} · {}",
        group
          .finish
          .as_deref()
          .map(finish_label)
          .unwrap_or_else(|| phase_label(&progress.phase)),
        group.name
      ));
      let bytes = if progress.all_totals_known
        && progress.known_total_bytes >= progress.received_bytes
        && progress.known_total_bytes > 0
      {
        format!(
          "{}/{}",
          format_bytes(progress.received_bytes),
          format_bytes(progress.known_total_bytes)
        )
      } else {
        format_bytes(progress.received_bytes)
      };
      group_bar
        .bar
        .set_prefix(if group.finish.is_none() && speed > 0 {
          format!("{bytes} · {}/s", format_bytes(speed))
        } else {
          bytes
        });
      if group.finish.as_deref() == Some("completed") {
        group_bar.bar.finish();
      } else if group.finish.is_some() {
        group_bar.bar.abandon();
      }
    } else {
      let summary = format!(
        "{}: {}/{} ({})",
        group.name,
        group.stats.done,
        group.stats.total,
        group.finish.as_deref().unwrap_or(&group.state)
      );
      if self.summaries.get(&group.id) != Some(&summary) {
        eprintln!("{summary}");
        self.summaries.insert(group.id.clone(), summary);
      }
    }
  }
}

impl Drop for ProgressDisplay {
  fn drop(&mut self) {
    if let Some(multi) = &self.multi {
      let _ = multi.clear();
    }
  }
}

fn phase_label(phase: &str) -> &str {
  match phase {
    "download" => "Downloading",
    "prepare" => "Preparing",
    "install" => "Installing",
    "verify" => "Verifying",
    _ => "Waiting",
  }
}

fn finish_label(finish: &str) -> &str {
  match finish {
    "completed" => "Completed",
    "cancelled" => "Cancelled",
    _ => "Failed",
  }
}

fn format_bytes(bytes: u64) -> String {
  let mut size = bytes as f64;
  let mut unit = "B";
  for next in ["KiB", "MiB", "GiB", "TiB"] {
    if size < 1024.0 {
      break;
    }
    size /= 1024.0;
    unit = next;
  }
  if unit == "B" {
    format!("{bytes} B")
  } else {
    format!("{size:.1} {unit}")
  }
}

impl InstallOptions {
  pub fn parse(args: &[String]) -> Result<Self, String> {
    let mut positional = Vec::new();
    let mut directory_name = None;
    let mut loader_type = None;
    let mut loader_version = None;
    let mut optifine_version = None;
    let mut wait = true;
    let mut index = 0;

    while index < args.len() {
      match args[index].as_str() {
        "--directory" | "--loader" | "--loader-version" | "--optifine" => {
          let flag = args[index].as_str();
          let value = args
            .get(index + 1)
            .filter(|value| !value.is_empty() && !value.starts_with("--"))
            .ok_or_else(|| format!("missing value for {flag}"))?
            .clone();
          match flag {
            "--directory" => directory_name = Some(value),
            "--loader" => loader_type = Some(value),
            "--loader-version" => loader_version = Some(value),
            "--optifine" => optifine_version = Some(value),
            _ => unreachable!(),
          }
          index += 2;
        }
        "--no-wait" => {
          wait = false;
          index += 1;
        }
        value if value.starts_with('-') => return Err(format!("unknown install option `{value}`")),
        value => {
          positional.push(value.to_string());
          index += 1;
        }
      }
    }

    if positional.len() != 2 {
      return Err("usage: sjmcl-cli install <game-version> <name> [options]".to_string());
    }
    if loader_version.is_some() && loader_type.is_none() {
      return Err("--loader-version requires --loader".to_string());
    }
    Ok(Self {
      game_version: positional.remove(0),
      name: positional.remove(0),
      directory_name,
      loader_type,
      loader_version,
      optifine_version,
      wait,
    })
  }
}

impl FileDownloadOptions {
  pub fn parse(args: &[String]) -> Result<Self, String> {
    let mut positional = Vec::new();
    let mut sha1 = None;
    let mut wait = true;
    let mut index = 0;
    while index < args.len() {
      match args[index].as_str() {
        "--sha1" => {
          sha1 = Some(
            args
              .get(index + 1)
              .filter(|value| !value.is_empty() && !value.starts_with("--"))
              .ok_or_else(|| "missing value for --sha1".to_string())?
              .clone(),
          );
          index += 2;
        }
        "--no-wait" => {
          wait = false;
          index += 1;
        }
        value if value.starts_with('-') => {
          return Err(format!("unknown download option `{value}`"));
        }
        value => {
          positional.push(value.to_string());
          index += 1;
        }
      }
    }
    if positional.len() != 2 {
      return Err("usage: sjmcl-cli download <url> <dest> [options]".to_string());
    }
    Ok(Self {
      url: positional.remove(0),
      dest: positional.remove(0),
      sha1,
      wait,
    })
  }
}

pub async fn run(client: &LauncherClient, options: InstallOptions) -> Result<(), String> {
  let config: LauncherConfig = serde_json::from_value(
    with_spinner(call_json(client, "retrieve_launcher_config", Map::new())).await?,
  )
  .map_err(|error| format!("invalid launcher config response: {error}"))?;
  let directory = choose_directory(&config, options.directory_name.as_deref())?;
  let instance_id = format!("{}:{}", directory.name, options.name);
  let mut arguments = Map::new();
  arguments.insert("directory_name".into(), json!(directory.name));
  arguments.insert("directory_path".into(), json!(directory.dir));
  arguments.insert("name".into(), json!(options.name));
  arguments.insert("game_version".into(), json!(options.game_version));
  if let Some(value) = options.loader_type {
    arguments.insert("mod_loader_type".into(), json!(value));
  }
  if let Some(value) = options.loader_version {
    arguments.insert("mod_loader_version".into(), json!(value));
  }
  if let Some(value) = options.optifine_version {
    arguments.insert("optifine_version".into(), json!(value));
  }
  let result = with_spinner(call_json(client, "create_instance", arguments)).await?;
  let group_id = result
    .get("value")
    .and_then(Value::as_str)
    .ok_or_else(|| "create_instance did not return a download group ID".to_string())?;
  println!("Installation queued: {instance_id} (group {group_id})");
  if options.wait {
    wait_for_groups(client, group_id, Some(&instance_id)).await?;
    println!("Installed: {instance_id}");
  }
  Ok(())
}

pub async fn run_download(
  client: &LauncherClient,
  options: FileDownloadOptions,
) -> Result<(), String> {
  let mut arguments = Map::new();
  arguments.insert("url".into(), json!(options.url));
  arguments.insert("dest".into(), json!(options.dest));
  arguments.insert("confirm".into(), json!(true));
  if let Some(sha1) = options.sha1 {
    arguments.insert("sha1".into(), json!(sha1));
  }
  let result = with_spinner(call_json(client, "submit_download", arguments)).await?;
  let group_id = result
    .get("value")
    .and_then(Value::as_str)
    .ok_or_else(|| "submit_download did not return a download group ID".to_string())?;
  println!("Download queued: {} (group {group_id})", options.dest);
  if options.wait {
    wait_for_groups(client, group_id, None).await?;
    println!("Downloaded: {}", options.dest);
  }
  Ok(())
}

pub async fn list_downloads(client: &LauncherClient) -> Result<(), String> {
  let groups = with_spinner(retrieve_groups(client)).await?;
  let mut table = Table::new();
  table.load_preset(UTF8_FULL_CONDENSED);
  table.set_content_arrangement(ContentArrangement::DynamicFullWidth);
  table.set_header(vec!["ID", "Name", "State", "Tasks"]);
  for group in groups {
    table.add_row(vec![
      group.id,
      group.name,
      group.finish.unwrap_or(group.state),
      format!("{}/{}", group.stats.done, group.stats.total),
    ]);
  }
  println!("{table}");
  Ok(())
}

fn choose_directory<'a>(
  config: &'a LauncherConfig,
  name: Option<&str>,
) -> Result<&'a GameDirectory, String> {
  match name {
    Some(name) => config
      .local_game_directories
      .iter()
      .find(|directory| directory.name == name)
      .ok_or_else(|| format!("game directory `{name}` was not found")),
    None if config.local_game_directories.len() == 1 => Ok(&config.local_game_directories[0]),
    None => Err(format!(
      "choose a game directory with --directory (available: {})",
      config
        .local_game_directories
        .iter()
        .map(|directory| directory.name.as_str())
        .collect::<Vec<_>>()
        .join(", ")
    )),
  }
}

async fn wait_for_groups(
  client: &LauncherClient,
  initial_group_id: &str,
  instance_id: Option<&str>,
) -> Result<(), String> {
  let mut display = ProgressDisplay::new();
  loop {
    let groups = retrieve_groups(client).await?;
    let initial = groups
      .iter()
      .find(|group| group.id == initial_group_id)
      .ok_or_else(|| format!("download group `{initial_group_id}` was removed"))?;
    let related = match instance_id {
      Some(instance_id) => installation_groups(&groups, instance_id, initial_group_id),
      None => vec![initial],
    };
    for group in &related {
      let progress = if display.multi.is_some() {
        Some(retrieve_progress(client, &group.id).await?)
      } else {
        None
      };
      display.update(group, progress.as_ref());
    }
    for group in &related {
      if group
        .finish
        .as_deref()
        .is_some_and(|finish| finish != "completed")
      {
        return Err(group_failure(client, group).await);
      }
    }
    if initial.finish.as_deref() == Some("completed")
      && related
        .iter()
        .all(|group| group.finish.as_deref() == Some("completed"))
    {
      return Ok(());
    }
    sleep(Duration::from_millis(500)).await;
  }
}

fn installation_groups<'a>(
  groups: &'a [DownloadGroup],
  instance_id: &str,
  initial_group_id: &str,
) -> Vec<&'a DownloadGroup> {
  let suffix = format!("?{instance_id}");
  groups
    .iter()
    .filter(|group| {
      group.id == initial_group_id
        || (group.name.contains("-libraries?") && group.name.ends_with(&suffix))
    })
    .collect()
}

async fn group_failure(client: &LauncherClient, group: &DownloadGroup) -> String {
  let reason = match retrieve_tasks(client, &group.id).await {
    Ok(tasks) => tasks
      .into_iter()
      .find(|task| task.state == "failed")
      .map(|task| {
        let error = task
          .error
          .map(|error| error.to_string())
          .unwrap_or_else(|| "unknown error".to_string());
        format!("{}: {error}", task.name)
      })
      .unwrap_or_else(|| "no failed task details available".to_string()),
    Err(error) => error,
  };
  format!(
    "installation group `{}` {}: {reason}",
    group.name,
    group.finish.as_deref().unwrap_or("failed")
  )
}

async fn retrieve_groups(client: &LauncherClient) -> Result<Vec<DownloadGroup>, String> {
  let value = call_json(client, "retrieve_download_groups", Map::new()).await?;
  serde_json::from_value::<Items<DownloadGroup>>(value)
    .map(|result| result.items)
    .map_err(|error| format!("invalid download group response: {error}"))
}

async fn retrieve_tasks(
  client: &LauncherClient,
  group_id: &str,
) -> Result<Vec<DownloadTask>, String> {
  let mut arguments = Map::new();
  arguments.insert("group_id".into(), json!(group_id));
  let value = call_json(client, "retrieve_download_tasks", arguments).await?;
  serde_json::from_value::<Items<DownloadTask>>(value)
    .map(|result| result.items)
    .map_err(|error| format!("invalid download task response: {error}"))
}

async fn retrieve_progress(
  client: &LauncherClient,
  group_id: &str,
) -> Result<DownloadProgress, String> {
  let mut arguments = Map::new();
  arguments.insert("group_id".into(), json!(group_id));
  let value = call_json(client, "retrieve_download_progress", arguments).await?;
  let progress: DownloadProgress = serde_json::from_value(value)
    .map_err(|error| format!("invalid download progress response: {error}"))?;
  if progress.group_id != group_id {
    return Err("download progress belongs to a different task group".to_string());
  }
  Ok(progress)
}

async fn call_json(
  client: &LauncherClient,
  name: &str,
  arguments: Map<String, Value>,
) -> Result<Value, String> {
  let result = client
    .call_tool(CallToolRequestParams::new(name.to_string()).with_arguments(arguments))
    .await
    .map_err(service_error_to_string)?;
  if result.is_error == Some(true) {
    let message = result
      .content
      .iter()
      .filter_map(|content| content.as_text().map(|text| text.text.as_str()))
      .collect::<Vec<_>>()
      .join("; ");
    return Err(format!("tool `{name}` failed: {message}"));
  }
  result
    .structured_content
    .ok_or_else(|| format!("tool `{name}` returned no structured result"))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parse_install_options() {
    let args = [
      "1.21.5",
      "Test",
      "--loader",
      "fabric",
      "--directory",
      "Main",
      "--no-wait",
    ]
    .map(str::to_string);
    let parsed = InstallOptions::parse(&args).unwrap();
    assert_eq!(parsed.game_version, "1.21.5");
    assert_eq!(parsed.name, "Test");
    assert_eq!(parsed.directory_name.as_deref(), Some("Main"));
    assert_eq!(parsed.loader_type.as_deref(), Some("fabric"));
    assert!(!parsed.wait);
  }

  #[test]
  fn install_options_require_loader_for_loader_version() {
    let args = ["1.21.5", "Test", "--loader-version", "0.16.0"].map(str::to_string);
    assert!(InstallOptions::parse(&args).is_err());
  }

  #[test]
  fn parse_file_download_options() {
    let args = [
      "https://example.com/file.jar",
      "/tmp/file.jar",
      "--sha1",
      "abc123",
      "--no-wait",
    ]
    .map(str::to_string);
    let parsed = FileDownloadOptions::parse(&args).unwrap();
    assert_eq!(parsed.dest, "/tmp/file.jar");
    assert_eq!(parsed.sha1.as_deref(), Some("abc123"));
    assert!(!parsed.wait);
  }

  #[test]
  fn progress_bar_template_is_valid() {
    assert!(ProgressStyle::with_template(PROGRESS_TEMPLATE).is_ok());
  }

  #[test]
  fn installation_follows_loader_and_optifine_groups() {
    let groups: Items<DownloadGroup> = serde_json::from_value(json!({
      "items": [
        {"id": "initial", "name": "game-client?Test", "state": "finished", "finish": "completed", "stats": {"total": 2, "done": 2}},
        {"id": "loader", "name": "forge-libraries?Main:Test", "state": "active", "finish": null, "stats": {"total": 3, "done": 1}},
        {"id": "optifine", "name": "optifine-libraries?Main:Test", "state": "queued", "finish": null, "stats": {"total": 2, "done": 0}},
        {"id": "other", "name": "forge-libraries?Main:Other", "state": "active", "finish": null, "stats": {"total": 3, "done": 1}}
      ]
    }))
    .unwrap();
    let related = installation_groups(&groups.items, "Main:Test", "initial");
    assert_eq!(
      related
        .iter()
        .map(|group| group.id.as_str())
        .collect::<Vec<_>>(),
      ["initial", "loader", "optifine"]
    );
  }
}
