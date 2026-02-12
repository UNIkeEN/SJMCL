use crate::intelligence::mcp_server::launcher::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::ToolRoute;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![mcp_tool!(
    sync "retrieve_player_list",
    crate::account::commands::retrieve_player_list,
    "Retrieve all account(player) profiles stored in the launcher, including offline, Microsoft and 3rd-party authenticated accounts."
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
  )]
}
