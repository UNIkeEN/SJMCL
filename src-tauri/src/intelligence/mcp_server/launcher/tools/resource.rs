use rmcp::handler::server::tool::ToolRoute;
use serde::Deserialize;
use std::path::PathBuf;
use std::str::FromStr;
use tauri::{Manager, State};
use tauri_plugin_http::reqwest;

use crate::instance::models::misc::ModLoaderType;
use crate::intelligence::mcp_server::launcher::McpContext;
use crate::intelligence::mcp_server::model::MCPError;
use crate::mcp_tool;
use crate::resource::commands::{
  download_game_server, fetch_game_version_list, fetch_game_version_specific,
  fetch_mod_loader_version_list, fetch_optifine_version_list, fetch_resource_list_by_name,
};
use crate::resource::models::{OtherResourceSearchQuery, OtherResourceSource, ResourceError};

#[derive(Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct McpOtherResourceSearchQuery {
  #[schemars(
    description = "Resource type, for example `mod`, `resourcepack`, `shader`, `datapack`, or `save`."
  )]
  resource_type: String,
  #[schemars(description = "Search keywords.")]
  search_query: String,
  #[schemars(description = "Minecraft game version filter. Use an empty string for no filter.")]
  game_version: String,
  #[schemars(description = "Tag/category filter. Use an empty string for no filter.")]
  selected_tag: String,
  #[schemars(description = "Sort key supported by the selected source.")]
  sort_by: String,
  #[schemars(description = "1-based page number.")]
  page: u32,
  #[schemars(description = "Page size.")]
  page_size: u32,
}

fn to_search_query(query: McpOtherResourceSearchQuery) -> OtherResourceSearchQuery {
  OtherResourceSearchQuery {
    resource_type: query.resource_type,
    search_query: query.search_query,
    game_version: query.game_version,
    selected_tag: query.selected_tag,
    sort_by: query.sort_by,
    page: query.page,
    page_size: query.page_size,
  }
}

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![
    mcp_tool!(
      "fetch_game_version_list",
      fetch_game_version_list,
      "Fetch the list of available Minecraft game versions."
    ),
    mcp_tool!(
      "fetch_game_version_specific",
      fetch_game_version_specific,
      "Fetch metadata for a specific Minecraft game version.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft game version ID, for example `1.21.5`.")]
        game_version: String,
      }
    ),
    mcp_tool!(
      "fetch_mod_loader_version_list",
      "Fetch available mod loader versions for a Minecraft game version.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft game version ID.")]
        game_version: String,
        #[schemars(description = "Mod loader type. Accepted values include `forge`, `legacyforge`, `fabric`, `neoforge`, and `quilt`.")]
        mod_loader_type: String,
      } => async move {
        let mod_loader_type =
          ModLoaderType::from_str(&params.mod_loader_type).map_err(|_| ResourceError::ParseError)?;
        fetch_mod_loader_version_list(app, params.game_version, mod_loader_type).await
      }
    ),
    mcp_tool!(
      "fetch_optifine_version_list",
      fetch_optifine_version_list,
      "Fetch available OptiFine versions for a Minecraft game version.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft game version ID.")]
        game_version: String,
      }
    ),
    mcp_tool!(
      "fetch_resource_list_by_name",
      "Search remote resources by name from CurseForge or Modrinth.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Download source. Accepted values: `curseforge` or `modrinth`.")]
        download_source: String,
        #[schemars(description = "Search query options.")]
        query: McpOtherResourceSearchQuery,
      } => async move {
        let download_source = OtherResourceSource::from_str(&params.download_source)
          .map_err(|_| ResourceError::NoDownloadApi)?;
        let mut result = fetch_resource_list_by_name(app, download_source, to_search_query(params.query)).await?;
        for resource in &mut result.list {
          resource.icon_src.clear();  // Clear the icon field to reduce payload size for LLMs.
        }
        Ok(result)
      }
    ),
    mcp_tool!(
      "download_game_server",
      "Schedule a Minecraft dedicated server jar download for the given game version. Requires confirm=true.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft game version ID.")]
        game_version: String,
        #[schemars(description = "Destination directory or file path. If this points to an existing directory, `server.jar` is appended automatically.")]
        dest: String,
        #[schemars(description = "Must be true to confirm scheduling the server download.")]
        confirm: bool,
      } => async move {
        if !params.confirm {
          return Err(MCPError::ToolNeedsConfirmation.into());
        }
        let path = PathBuf::from(params.dest.trim());
        let dest = if path.is_dir() {
          path.join("server.jar").to_string_lossy().to_string()
        } else {
          path.to_string_lossy().to_string()
        };
        let resource_info = fetch_game_version_specific(app.clone(), params.game_version).await?;
        let app_for_download = app.clone();
        let client_state: State<reqwest::Client> = app.state();
        download_game_server(app_for_download, client_state, resource_info, dest).await
      }
    ),
  ]
}
