use crate::mcp_server::McpContext;
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
    mcp_tool!(
      "select_player",
      "A shortcut tool to update selected player by its ID in launcher config, which will be used for game launches.",
      |app, params: rmcp::model::JsonObject| async move {
        let json_value = serde_json::Value::Object(params);
        let id = json_value["id"].as_str().unwrap_or("").trim();

        let value =
          serde_json::to_string(&id).map_err(|e| crate::error::SJMCLError(e.to_string()))?;
        crate::launcher_config::commands::update_launcher_config(
          app,
          "states.shared.selected_player_id".to_string(),
          value,
        )
      }
    ),
  ]
}
