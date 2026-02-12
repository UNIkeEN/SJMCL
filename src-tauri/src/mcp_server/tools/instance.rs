use crate::mcp_server::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::ToolRoute;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![mcp_tool!(
    "retrieve_instance_list",
    crate::instance::commands::retrieve_instance_list,
    "Retrieve metadata of all local Minecraft instances recognized by the launcher."
  )]
}
