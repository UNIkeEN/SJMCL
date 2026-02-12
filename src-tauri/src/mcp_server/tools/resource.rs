use crate::mcp_server::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::ToolRoute;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![mcp_tool!(
    "fetch_game_version_list",
    crate::resource::commands::fetch_game_version_list,
    "Fetch the list of available Minecraft game versions."
  )]
}
