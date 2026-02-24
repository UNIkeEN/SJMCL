use crate::intelligence::mcp_server::launcher::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::ToolRoute;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![
    mcp_tool!(
      "retrieve_player_list",
      "Retrieve all Minecraft account(player) profiles stored in the launcher, including offline, Microsoft and 3rd-party authenticated accounts.",
      |app, _params: rmcp::model::JsonObject| async move {
        let mut players = crate::account::commands::retrieve_player_list(app)?;
        // remove token and base64 texture data in MCP responses to reduce context length.
        for player in &mut players {
          player.avatar = Vec::new();
          player.textures = Vec::new();
          player.access_token = None;
          player.refresh_token = None;
        }
        Ok(players)
      }
    ),
    mcp_tool!(
      "select_player",
      "A shortcut tool to update selected player by its ID in launcher config, which will be used for Minecraft game launches. Player ID can be obtained from retrieve_player_list tool.",
      |app, params: rmcp::model::JsonObject| async move {
        let json_value = serde_json::Value::Object(params);
        let id = json_value["id"].as_str().unwrap_or("").trim();

        let value =
          serde_json::to_string(&id).map_err(|e| crate::error::SJMCLError(e.to_string()))?;
        crate::launcher_config::commands::update_launcher_config(
          app,
          "states.shared.selectedPlayerId".to_string(),
          value,
        )
      }
    ),
  ]
}
