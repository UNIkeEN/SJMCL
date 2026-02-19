use crate::intelligence::mcp_server::launcher::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::{parse_json_object, ToolCallContext, ToolRoute};
use rmcp::model::{CallToolResult, Content};
use serde::Deserialize;

// For debugging.
#[derive(Debug, Clone, Deserialize)]
pub struct EchoTextParams {
  pub text: String,
}

async fn echo_text(
  mut context: ToolCallContext<'_, McpContext>,
) -> Result<CallToolResult, rmcp::ErrorData> {
  let params: EchoTextParams = parse_json_object(context.arguments.take().unwrap_or_default())?;
  Ok(CallToolResult::success(vec![Content::text(params.text)]))
}

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![mcp_tool!(
    raw "echo_text",
    echo_text,
    "Echo the provided text. Demonstrates arbitrary Rust function tool wiring."
  )]
}
