use crate::intelligence::mcp_server::launcher::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::ToolRoute;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![
    mcp_tool!(
      "retrieve_instance_list",
      crate::instance::commands::retrieve_instance_list,
      "Retrieve metadata of all local Minecraft instances recognized by the launcher."
    ),
    mcp_tool!(
      "retrieve_world_list",
      crate::instance::commands::retrieve_world_list,
      "Retrieve metadata of all local worlds (saves) in the given instance.",
      { instance_id: String }
    ),
    mcp_tool!(
      "retrieve_local_mod_list",
      crate::instance::commands::retrieve_local_mod_list,
      "Retrieve metadata of all local mods in the given instance.",
      { instance_id: String }
    ),
    mcp_tool!(
      "retrieve_game_server_list",
      "Retrieve game servers list of the given instance and query online status.",
      |app, params: rmcp::model::JsonObject| async move {
        let instance_id = params["instance_id"]
          .as_str()
          .unwrap_or_default()
          .to_string();
        crate::instance::commands::retrieve_game_server_list(app, instance_id, true).await
      }
    ),
  ]
}
