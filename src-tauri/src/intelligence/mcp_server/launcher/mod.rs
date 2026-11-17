mod r#macro;
pub mod tools;

use rmcp::handler::server::tool::ToolRouter;
use rmcp::model::{
  CallToolResponse, CallToolResult, Implementation, ServerCapabilities, ServerConfig,
};
use rmcp::transport::streamable_http_server::{
  StreamableHttpServerConfig, StreamableHttpService, session::local::LocalSessionManager,
};
use rmcp::{ErrorData as McpError, ServerHandler};
use serde::Serialize;
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use tauri::AppHandle;

use crate::launcher_config::models::LauncherMcpServerConfig;
use crate::utils::sys_info::find_free_port;

pub const MCP_SERVER_HOST: &str = "127.0.0.1";
pub const MCP_SERVER_PATH: &str = "/mcp";

#[derive(Clone)]
pub struct McpContext {
  pub app_handle: AppHandle,
  tool_router: ToolRouter<Self>,
}

impl McpContext {
  pub fn new(app_handle: AppHandle) -> Self {
    let mut tool_router = ToolRouter::new();
    for route in tools::tool_routes() {
      tool_router.add_route(route);
    }
    Self {
      app_handle,
      tool_router,
    }
  }
}

#[rmcp::tool_handler(router = self.tool_router)]
impl ServerHandler for McpContext {
  fn get_info(&self) -> ServerConfig {
    ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
      .with_server_info(
        Implementation::new("sjmcl-mcp", env!("CARGO_PKG_VERSION"))
          .with_title("SJMCL MCP")
          .with_description("MCP tools exposed by SJMCL, a modern Minecraft launcher"),
      )
      .with_instructions(
        "Use tools to query Minecraft instances and accounts managed by SJMC Launcher. When a tool requires instance_id, first list available instances and then pass one returned id. This server is intended for local trusted clients."
      )
  }
}

pub fn command_result_to_tool_result<T>(
  command_result: SJMCLResult<T>,
) -> Result<CallToolResponse, McpError>
where
  T: Serialize,
{
  let value = command_result.map_err(|e| McpError::internal_error(e.0, None))?;

  let json_value = serde_json::to_value(value).map_err(|e| {
    McpError::internal_error(format!("failed to serialize command result: {e}"), None)
  })?;

  // convert to object, support most MCP clients (e.g. Claude Desktop)
  let structured_content = match json_value {
    serde_json::Value::Object(_) => json_value,
    serde_json::Value::Array(_) => serde_json::json!({ "items": json_value }),
    _ => serde_json::json!({ "value": json_value }),
  };

  Ok(CallToolResult::structured(structured_content).into())
}

pub fn run(app_handle: AppHandle, mcp_config: &LauncherMcpServerConfig) {
  let enabled = mcp_config.enabled;
  let port = mcp_config.port;

  if !enabled {
    return;
  }

  // bind preset fixed port.
  match find_free_port(Some(port)) {
    Ok(free_port) if free_port == port => {}
    Ok(free_port) => {
      log::warn!(
        "MCP server unavailable, configured port {} is occupied (next free: {}).",
        port,
        free_port
      );
      return;
    }
    Err(err) => {
      log::warn!(
        "MCP server unavailable, failed to probe free port: {}",
        err.0
      );
      return;
    }
  }

  let bind_addr = format!("{MCP_SERVER_HOST}:{port}");
  let listener = (|| -> std::io::Result<tokio::net::TcpListener> {
    let std_listener = std::net::TcpListener::bind(&bind_addr)?;
    std_listener.set_nonblocking(true)?;
    tokio::net::TcpListener::from_std(std_listener)
  })();
  let listener = match listener {
    Ok(listener) => listener,
    Err(err) => {
      log::warn!("MCP server unavailable, failed to prepare listener on {bind_addr}: {err}");
      return;
    }
  };

  log::info!("MCP server endpoint: http://{bind_addr}{MCP_SERVER_PATH}");

  // spawn MCP server
  tauri::async_runtime::spawn(async move {
    if let Err(e) = serve(app_handle.clone(), listener, port).await {
      log::error!("MCP HTTP server exited with error: {}", e.0);
    }
  });
}

async fn serve(
  app_handle: AppHandle,
  listener: tokio::net::TcpListener,
  port: u16,
) -> SJMCLResult<()> {
  let service_app_handle = app_handle.clone();
  let service: StreamableHttpService<McpContext, LocalSessionManager> = StreamableHttpService::new(
    move || Ok(McpContext::new(service_app_handle.clone())),
    Default::default(),
    StreamableHttpServerConfig::default().with_legacy_session_mode(true),
  );

  let axum_router = axum::Router::new().nest_service(MCP_SERVER_PATH, service);
  let bind_addr = format!("{MCP_SERVER_HOST}:{port}");

  log::info!(
    "MCP HTTP server listening on http://{}{}",
    bind_addr,
    MCP_SERVER_PATH
  );

  axum::serve(listener, axum_router)
    .await
    .map_err(|e| SJMCLError(e.to_string()))?;

  Ok(())
}
