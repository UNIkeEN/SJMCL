use crate::intelligence::mcp_server::launcher::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::ToolRoute;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![
    mcp_tool!(
      sync "retrieve_launcher_config",
      crate::launcher_config::commands::retrieve_launcher_config,
      "Retrieve full launcher configuration snapshot. This includes game launch settings, game directory settings, launcher app settings, currently selected instance/account, and other global preferences."
    ),
    mcp_tool!(
      sync "update_launcher_config",
      crate::launcher_config::commands::update_launcher_config,
      "Update a launcher config field by key_path. Use this to change game settings, launcher app settings, selected instance/account ID, and other config values.",
      { key_path: String, value: String }
    ),
  ]
}
