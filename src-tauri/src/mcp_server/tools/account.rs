use crate::mcp_server::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::ToolRoute;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![mcp_tool!(
    sync "retrieve_player_list",
    crate::account::commands::retrieve_player_list,
    "Retrieve all account(player) profiles stored in the launcher, including offline, Microsoft and 3rd-party authenticated accounts."
  )]
}
