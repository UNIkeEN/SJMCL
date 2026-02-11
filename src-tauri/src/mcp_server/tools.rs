use crate::mcp_server::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::{parse_json_object, ToolCallContext, ToolRoute};
use rmcp::model::{CallToolResult, Content};
use serde::Deserialize;

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
  vec![
    mcp_tool!(
      "retrieve_instance_list",
      crate::instance::commands::retrieve_instance_list,
      "Retrieve all local Minecraft instances visible in the launcher."
    ),
    mcp_tool!(
      sync "retrieve_launcher_config",
      crate::launcher_config::commands::retrieve_launcher_config,
      "Retrieve current launcher configuration."
    ),
    mcp_tool!(
      "retrieve_world_list",
      crate::instance::commands::retrieve_world_list,
      "Retrieve worlds for a specific instance id.",
      { instance_id: String }
    ),
    // For test
    mcp_tool!(
      raw "echo_text",
      echo_text,
      "Echo the provided text. Demonstrates arbitrary Rust function tool wiring."
    ),
  ]
}
