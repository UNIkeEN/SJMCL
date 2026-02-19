use crate::intelligence::mcp_server::launcher::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::ToolRoute;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![
    mcp_tool!(
      "retrieve_instance_list",
      crate::instance::commands::retrieve_instance_list,
      "List all local Minecraft instances and return their IDs and metadata. Use this first when another tool requires instance_id."
    ),
    mcp_tool!(
      "retrieve_world_list",
      crate::instance::commands::retrieve_world_list,
      "Retrieve metadata of local worlds (saves) in the given Minecraft instance. Input param: instance_id (string).",
      { instance_id: String }
    ),
    mcp_tool!(
      "retrieve_game_server_list",
      "Retrieve metadata of servers configured in the given Minecraft instance and query online status. Input param: instance_id (string). Call retrieve_instance_list first to get a valid instance_id.",
      |app, params: rmcp::model::JsonObject| async move {
        let instance_id = params["instance_id"]
          .as_str()
          .unwrap_or_default()
          .to_string();
        // always query online status in MCP context.
        crate::instance::commands::retrieve_game_server_list(app, instance_id, true).await
      }
    ),
    mcp_tool!(
      "retrieve_local_mod_list",
      "Retrieve metadata of local mods in the given Minecraft instance. Input param: instance_id (string).",
      |app, params: rmcp::model::JsonObject| async move {
        let instance_id = params["instance_id"]
          .as_str()
          .unwrap_or_default()
          .to_string();
        let mut mods = crate::instance::commands::retrieve_local_mod_list(app, instance_id).await?;
        // strip icon binary payload in MCP responses to reduce context length.
        for mod_info in &mut mods {
          mod_info.icon_src = Default::default();
        }
        Ok(mods)
      }
    ),
    mcp_tool!(
      "retrieve_resource_pack_list",
      crate::instance::commands::retrieve_resource_pack_list,
      "Retrieve resource packs in the given Minecraft instance. Input param: instance_id (string).",
      { instance_id: String }
    ),
    mcp_tool!(
      "retrieve_server_resource_pack_list",
      crate::instance::commands::retrieve_server_resource_pack_list,
      "Retrieve server resource packs in the given Minecraft instance. Input param: instance_id (string).",
      { instance_id: String }
    ),
    mcp_tool!(
      sync "retrieve_schematic_list",
      crate::instance::commands::retrieve_schematic_list,
      "Retrieve schematics in the given Minecraft instance. Input param: instance_id (string).",
      { instance_id: String }
    ),
    mcp_tool!(
      sync "retrieve_shader_pack_list",
      crate::instance::commands::retrieve_shader_pack_list,
      "Retrieve shader packs in the given Minecraft instance. Input param: instance_id (string).",
      { instance_id: String }
    ),
    mcp_tool!(
      sync "retrieve_screenshot_list",
      crate::instance::commands::retrieve_screenshot_list,
      "Retrieve screenshots in the given Minecraft instance. Input param: instance_id (string).",
      { instance_id: String }
    ),
    mcp_tool!(
      "toggle_mod_by_extension",
      "Enable or disable a mod file by toggling .disabled extension. Input params: file_path (string), enable (boolean). File path can be obtained from retrieve_local_mod_list tool.",
      |_app, params: rmcp::model::JsonObject| async move {
        let file_path = params["file_path"].as_str().unwrap_or_default().to_string();
        let enable = params["enable"].as_bool().unwrap_or(true);
        crate::instance::commands::toggle_mod_by_extension(
          std::path::PathBuf::from(file_path),
          enable,
        )
      }
    ),
  ]
}
