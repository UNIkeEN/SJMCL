use comfy_table::{presets::UTF8_FULL_CONDENSED, ContentArrangement, Table};
use indicatif::{ProgressBar, ProgressDrawTarget, ProgressStyle};
use rmcp::model::{CallToolRequestParams, Tool};
use rmcp::service::{RoleClient, RunningService};
use rmcp::transport::StreamableHttpClientTransport;
use rmcp::ServiceExt;
use serde_json::{Map, Value};
use std::env;
use std::ffi::OsString;
use std::io::{self, IsTerminal};
use std::process::Command;
use tokio::time::{sleep, Instant};

type LauncherClient = RunningService<RoleClient, ()>;

const DEFAULT_PORT: u16 = 18970;
const DEFAULT_CONNECT_TIMEOUT_MS: u64 = 5000;
const RETRY_INTERVAL_MS: u64 = 250;

const EXPECTED_SERVER_NAME: &str = "sjmcl-mcp";
const MCP_SERVER_HOST: &str = "127.0.0.1";
const MCP_SERVER_PATH: &str = "/mcp";
const RUN_SJMCL_DEEPLINK: &str = "sjmcl://run-silently";
const ENABLE_MCP_HINT: &str =
  "Please enable Launcher MCP Server in SJMCL - Intelligence to use the CLI.\nIf your MCP server uses a port other than the default 18970, run the CLI with `-p <port>`.";

#[derive(Clone)]
struct CliOptions {
  port: u16,
}

enum CliCommand {
  Help,
  Call {
    name: String,
    arguments: Map<String, Value>,
  },
}

struct CliInvocation {
  options: CliOptions,
  command: CliCommand,
}

#[tokio::main(flavor = "multi_thread")]
async fn main() {
  let exit_code = match run().await {
    Ok(()) => 0,
    Err(err) => {
      eprintln!("Error: {err}");
      1
    }
  };

  std::process::exit(exit_code);
}

async fn run() -> Result<(), String> {
  let invocation = CliInvocation::parse(env::args_os())?;

  match invocation.command {
    CliCommand::Help => {
      let (tools, hint) =
        match with_spinner(async { connect_launcher(&invocation.options).await }).await {
          Ok(client) => {
            let tools = with_spinner(async {
              client
                .list_all_tools()
                .await
                .map_err(service_error_to_string)
            })
            .await?;
            let _ = client.cancel().await;
            (Some(tools), None)
          }
          Err(err) => (None, Some(err)),
        };

      print_help(tools.as_deref(), hint.as_deref());
      Ok(())
    }
    CliCommand::Call { name, arguments } => {
      let client = with_spinner(async { connect_launcher(&invocation.options).await }).await?;
      let result = with_spinner(async {
        client
          .call_tool(CallToolRequestParams {
            meta: None,
            name: name.clone().into(),
            arguments: Some(arguments),
            task: None,
          })
          .await
          .map_err(service_error_to_string)
      })
      .await?;
      let _ = client.cancel().await;

      print_call_result(&result);

      if result.is_error == Some(true) {
        return Err(format!("tool `{name}` returned an MCP error"));
      }

      Ok(())
    }
  }
}

impl CliInvocation {
  fn parse<I>(args: I) -> Result<Self, String>
  where
    I: IntoIterator<Item = OsString>,
  {
    let mut args = args.into_iter();
    let _bin = args.next();

    let mut options = CliOptions { port: DEFAULT_PORT };
    let mut rest = Vec::new();

    while let Some(arg) = args.next() {
      let arg = os_string_to_string(arg)?;
      match arg.as_str() {
        "-h" | "--help" => {
          return Ok(Self {
            options,
            command: CliCommand::Help,
          });
        }
        "-p" | "--port" => {
          let value = args
            .next()
            .ok_or_else(|| "missing value for --port".to_string())?;
          options.port = parse_u16_option("--port", &os_string_to_string(value)?)?;
        }
        _ if arg.starts_with("-p=") => {
          options.port = parse_u16_option("-p", &arg["-p=".len()..])?;
        }
        _ if arg.starts_with("--port=") => {
          options.port = parse_u16_option("--port", &arg["--port=".len()..])?;
        }
        _ => {
          rest.push(arg);
          rest.extend(
            args
              .map(os_string_to_string)
              .collect::<Result<Vec<_>, _>>()?,
          );
          break;
        }
      }
    }

    if rest.is_empty() {
      return Ok(Self {
        options,
        command: CliCommand::Help,
      });
    }

    Ok(Self {
      options,
      command: CliCommand::Call {
        name: rest[0].clone(),
        arguments: parse_tool_arguments(&rest[1..])?,
      },
    })
  }
}

async fn connect_launcher(options: &CliOptions) -> Result<LauncherClient, String> {
  match try_connect(options.port).await {
    Ok(client) => Ok(client),
    Err(initial_err) => {
      run_sjmcl_deeplink()?;

      let deadline = Instant::now() + std::time::Duration::from_millis(DEFAULT_CONNECT_TIMEOUT_MS);
      let mut last_error = initial_err;

      while Instant::now() < deadline {
        sleep(std::time::Duration::from_millis(RETRY_INTERVAL_MS)).await;
        match try_connect(options.port).await {
          Ok(client) => return Ok(client),
          Err(err) => last_error = err,
        }
      }

      let _ = last_error;
      Err(ENABLE_MCP_HINT.to_string())
    }
  }
}

async fn try_connect(port: u16) -> Result<LauncherClient, String> {
  let endpoint = mcp_endpoint(port);
  let transport = StreamableHttpClientTransport::from_uri(endpoint.clone());
  let client = ()
    .serve(transport)
    .await
    .map_err(|err| format!("failed to initialize MCP client for {endpoint}: {err}"))?;

  let server_info = client
    .peer_info()
    .ok_or_else(|| format!("server at {endpoint} did not provide MCP server info"))?;

  if server_info.server_info.name != EXPECTED_SERVER_NAME {
    let actual_name = server_info.server_info.name.clone();
    let _ = client.cancel().await;
    return Err(format!(
      "endpoint {endpoint} is not the SJMCL MCP server (got `{actual_name}`)"
    ));
  }

  Ok(client)
}

fn print_help(tools: Option<&[Tool]>, hint: Option<&str>) {
  println!("SJMCL CLI {}", env!("CARGO_PKG_VERSION"));
  println!();
  println!("Usage:");
  println!("  sjmcl-cli -h | --help");
  println!("  sjmcl-cli [-p | --port <port>] <tool> [json-object]");

  if let Some(hint) = hint {
    println!();
    println!("{hint}");
  }

  if let Some(tools) = tools {
    println!();
    println!("Tools:");
    print_tool_list(tools);
  }
}

fn print_tool_list(tools: &[Tool]) {
  let mut table = Table::new();
  table.load_preset(UTF8_FULL_CONDENSED);
  table.set_content_arrangement(ContentArrangement::DynamicFullWidth);
  table.set_header(vec!["Tool", "Args", "Description"]);

  for tool in tools {
    let description = tool.description.as_deref().unwrap_or_default();
    let schema_hint = summarize_input_schema(tool);
    table.add_row(vec![tool.name.as_ref(), schema_hint.as_str(), description]);
  }

  println!("{table}");
}

fn summarize_input_schema(tool: &Tool) -> String {
  let required = tool
    .input_schema
    .get("required")
    .and_then(Value::as_array)
    .map(|items| {
      items
        .iter()
        .filter_map(Value::as_str)
        .map(ToString::to_string)
        .collect::<Vec<_>>()
    })
    .unwrap_or_default();

  let properties = tool
    .input_schema
    .get("properties")
    .and_then(Value::as_object)
    .map(|props| props.keys().cloned().collect::<Vec<_>>())
    .unwrap_or_default();

  if properties.is_empty() {
    return String::new();
  }

  properties
    .into_iter()
    .map(|name| {
      if required.contains(&name) {
        format!("<{name}>")
      } else {
        format!("[{name}]")
      }
    })
    .collect::<Vec<_>>()
    .join(" ")
}

fn print_call_result(result: &rmcp::model::CallToolResult) {
  if let Some(structured) = &result.structured_content {
    match serde_json::to_string_pretty(structured) {
      Ok(text) => {
        println!("{text}");
        return;
      }
      Err(_) => {
        println!("{structured}");
        return;
      }
    }
  }

  for content in &result.content {
    if let Some(text) = content.raw.as_text() {
      println!("{}", text.text);
    } else if let Ok(json) = serde_json::to_string_pretty(content) {
      println!("{json}");
    }
  }
}

fn parse_tool_arguments(args: &[String]) -> Result<Map<String, Value>, String> {
  if args.is_empty() {
    return Ok(Map::new());
  }

  if args.len() > 1 {
    return Err("tool arguments must be a single JSON object string".to_string());
  }

  let value: Value = serde_json::from_str(&args[0])
    .map_err(|err| format!("failed to parse tool arguments JSON: {err}"))?;
  value
    .as_object()
    .cloned()
    .ok_or_else(|| "tool arguments must be a JSON object".to_string())
}

fn run_sjmcl_deeplink() -> Result<(), String> {
  #[cfg(target_os = "macos")]
  let mut command = {
    let mut command = Command::new("open");
    command.arg(RUN_SJMCL_DEEPLINK);
    command
  };

  #[cfg(target_os = "linux")]
  let mut command = {
    let mut command = Command::new("xdg-open");
    command.arg(RUN_SJMCL_DEEPLINK);
    command
  };

  #[cfg(target_os = "windows")]
  let mut command = {
    let mut command = Command::new("cmd");
    command.args(["/C", "start", "", RUN_SJMCL_DEEPLINK]);
    command
  };

  command
    .status()
    .map_err(|err| format!("failed to open deeplink `{RUN_SJMCL_DEEPLINK}`: {err}"))
    .and_then(|status| {
      if status.success() {
        Ok(())
      } else {
        Err(format!(
          "deeplink launcher exited with status {} for `{RUN_SJMCL_DEEPLINK}`",
          status
        ))
      }
    })
}

fn mcp_endpoint(port: u16) -> String {
  format!("http://{MCP_SERVER_HOST}:{port}{MCP_SERVER_PATH}")
}

fn parse_u16_option(flag: &str, value: &str) -> Result<u16, String> {
  value
    .parse::<u16>()
    .ok()
    .filter(|port| *port > 0)
    .ok_or_else(|| format!("invalid value for {flag}: `{value}`"))
}

fn service_error_to_string(err: rmcp::service::ServiceError) -> String {
  err.to_string()
}

async fn with_spinner<F, T>(future: F) -> T
where
  F: std::future::Future<Output = T>,
{
  if !io::stderr().is_terminal() {
    return future.await;
  }

  let spinner = ProgressBar::new_spinner();
  spinner.set_draw_target(ProgressDrawTarget::stderr());
  spinner.set_style(
    ProgressStyle::with_template("{spinner}")
      .unwrap()
      .tick_strings(&["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]),
  );
  spinner.enable_steady_tick(std::time::Duration::from_millis(80));

  let result = future.await;
  spinner.finish_and_clear();
  result
}

fn os_string_to_string(value: OsString) -> Result<String, String> {
  value
    .into_string()
    .map_err(|_| "non-UTF-8 CLI arguments are not supported".to_string())
}
