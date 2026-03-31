use crate::intelligence::mcp_server::launcher::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::ToolRoute;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![
    mcp_tool!(
      "retrieve_instance_list",
      crate::instance::commands::retrieve_instance_list,
      "Primary tool for listing local Minecraft instances. Returns instance IDs and metadata for selecting an instance."
    ),
    mcp_tool!(
      "retrieve_world_list",
      crate::instance::commands::retrieve_world_list,
      "Retrieve local world metadata for a Minecraft instance.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      "retrieve_game_server_list",
      "Retrieve configured servers for a Minecraft instance and query their online status.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      } => async move {
        // always query online status in MCP context.
        crate::instance::commands::retrieve_game_server_list(app, params.instance_id, true).await
      }
    ),
    mcp_tool!(
      "retrieve_local_mod_list",
      "Retrieve local mod metadata for a Minecraft instance.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      } => async move {
        let mut mods =
          crate::instance::commands::retrieve_local_mod_list(app, params.instance_id).await?;
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
      "Retrieve resource packs for a Minecraft instance.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      "retrieve_server_resource_pack_list",
      crate::instance::commands::retrieve_server_resource_pack_list,
      "Retrieve server resource packs for a Minecraft instance.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      sync "retrieve_schematic_list",
      crate::instance::commands::retrieve_schematic_list,
      "Retrieve schematics for a Minecraft instance.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      sync "retrieve_shader_pack_list",
      crate::instance::commands::retrieve_shader_pack_list,
      "Retrieve shader packs for a Minecraft instance.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      sync "retrieve_screenshot_list",
      crate::instance::commands::retrieve_screenshot_list,
      "Retrieve screenshots for a Minecraft instance.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      "toggle_mod_by_extension",
      "Enable or disable a mod file by toggling its `.disabled` extension.",
      |_app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "File path from `retrieve_local_mod_list`.")]
        file_path: String,
        #[schemars(description = "Set to true to enable the mod file, or false to disable it.")]
        enable: bool,
      } => async move {
        crate::instance::commands::toggle_mod_by_extension(
          std::path::PathBuf::from(params.file_path),
          params.enable,
        )
      }
    ),
  ]
}
