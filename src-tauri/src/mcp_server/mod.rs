mod r#macro;
pub mod tools;

use crate::error::{SJMCLError, SJMCLResult};
use crate::utils::sys_info::find_free_port;
use rmcp::handler::server::router::Router;
use rmcp::model::{CallToolResult, Implementation, ServerCapabilities, ServerInfo};
use rmcp::transport::streamable_http_server::{
  session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
};
use rmcp::{ErrorData as McpError, ServerHandler};
use serde::Serialize;
use tauri::AppHandle;

pub const MCP_HOST: &str = "127.0.0.1";
pub const MCP_PATH: &str = "/mcp";
pub const MCP_PORT_START: u16 = 18970;

#[derive(Clone)]
pub struct McpContext {
  pub app_handle: AppHandle,
}

impl McpContext {
  pub fn new(app_handle: AppHandle) -> Self {
    Self { app_handle }
  }
}

impl ServerHandler for McpContext {
  fn get_info(&self) -> ServerInfo {
    ServerInfo {
      capabilities: ServerCapabilities::builder().enable_tools().build(),
      server_info: Implementation {
        name: "sjmcl-mcp".to_string(),
        title: Some("SJMCL MCP".to_string()),
        version: env!("CARGO_PKG_VERSION").to_string(),
        description: Some("MCP tools exposed by SJMCL".to_string()),
        icons: None,
        website_url: None,
      },
      instructions: Some(
        "Use tools to query launcher states. This server is intended for local trusted clients."
          .to_string(),
      ),
      ..Default::default()
    }
  }
}

pub fn command_result_to_tool_result<T>(
  command_result: SJMCLResult<T>,
) -> Result<CallToolResult, McpError>
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

  Ok(CallToolResult::structured(structured_content))
}

pub fn spawn_http_server(app_handle: AppHandle) -> SJMCLResult<String> {
  let port = find_free_port(Some(MCP_PORT_START))?;
  let endpoint = format!("http://{MCP_HOST}:{port}{MCP_PATH}");

  tauri::async_runtime::spawn(async move {
    if let Err(e) = serve_http(app_handle.clone(), port).await {
      log::error!("MCP HTTP server exited with error: {}", e.0);
    }
  });

  Ok(endpoint)
}

async fn serve_http(app_handle: AppHandle, port: u16) -> SJMCLResult<()> {
  let service_app_handle = app_handle.clone();
  let service: StreamableHttpService<Router<McpContext>, LocalSessionManager> =
    StreamableHttpService::new(
      move || {
        Ok(
          Router::new(McpContext::new(service_app_handle.clone())).with_tools(tools::tool_routes()),
        )
      },
      Default::default(),
      StreamableHttpServerConfig {
        stateful_mode: true,
        ..Default::default()
      },
    );

  let axum_router = axum::Router::new().nest_service(MCP_PATH, service);
  let bind_addr = format!("{MCP_HOST}:{port}");
  let listener = tokio::net::TcpListener::bind(&bind_addr).await?;

  log::info!(
    "MCP HTTP server listening on http://{}{}",
    bind_addr,
    MCP_PATH
  );

  axum::serve(listener, axum_router)
    .await
    .map_err(|e| SJMCLError(e.to_string()))?;

  Ok(())
}
