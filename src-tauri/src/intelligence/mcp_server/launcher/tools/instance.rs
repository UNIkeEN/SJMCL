use rmcp::handler::server::tool::ToolRoute;
use std::path::PathBuf;
use std::str::FromStr;

use crate::instance::commands::*;
use crate::instance::models::misc::{InstanceError, ModLoaderType};
use crate::intelligence::mcp_server::launcher::McpContext;
use crate::intelligence::mcp_server::model::MCPError;
use crate::launcher_config::models::GameDirectory;
use crate::mcp_tool;
use crate::resource::commands::{
  fetch_game_version_specific, fetch_mod_loader_version_list, fetch_optifine_version_list,
};
use crate::resource::models::{ModLoaderResourceInfo, OptiFineResourceInfo, ResourceError};

fn parse_mod_loader_type(
  loader_type: Option<String>,
) -> Result<ModLoaderType, sjmcl_types::error::SJMCLError> {
  match loader_type {
    Some(loader_type) if !loader_type.trim().is_empty() => {
      ModLoaderType::from_str(&loader_type).map_err(|_| ResourceError::NoDownloadApi.into())
    }
    _ => Ok(ModLoaderType::Unknown),
  }
}

async fn resolve_mod_loader(
  app: tauri::AppHandle,
  game_version: String,
  loader_type: ModLoaderType,
  loader_version: Option<String>,
) -> Result<ModLoaderResourceInfo, sjmcl_types::error::SJMCLError> {
  if loader_type == ModLoaderType::Unknown {
    return Ok(ModLoaderResourceInfo {
      loader_type: ModLoaderType::Unknown,
      version: String::new(),
      description: String::new(),
      stable: None,
      branch: None,
    });
  }

  let versions = fetch_mod_loader_version_list(app, game_version, loader_type).await?;
  if let Some(loader_version) = loader_version.filter(|version| !version.trim().is_empty()) {
    return versions
      .into_iter()
      .find(|item| item.version == loader_version)
      .ok_or_else(|| ResourceError::ParseError.into());
  }

  versions
    .iter()
    .find(|item| item.stable.unwrap_or(true))
    .cloned()
    .or_else(|| versions.into_iter().next())
    .ok_or_else(|| ResourceError::ParseError.into())
}

async fn resolve_optifine(
  app: tauri::AppHandle,
  game_version: String,
  optifine_version: Option<String>,
) -> Result<Option<OptiFineResourceInfo>, sjmcl_types::error::SJMCLError> {
  let Some(optifine_version) = optifine_version.filter(|version| !version.trim().is_empty()) else {
    return Ok(None);
  };

  let versions = fetch_optifine_version_list(app, game_version).await?;
  versions
    .into_iter()
    .find(|item| item.patch == optifine_version || item.filename == optifine_version)
    .map(Some)
    .ok_or_else(|| ResourceError::ParseError.into())
}

// In the user-facing workflow, the default icon mapping lives in the frontend create-instance modal.
fn default_icon_for_game_type(game_type: &str) -> String {
  match game_type {
    "snapshot" => "/images/icons/JEIcon_Snapshot.png",
    "old_beta" => "/images/icons/StoneOldBeta.png",
    "april_fools" => "/images/icons/YellowGlazedTerracotta.png",
    _ => "/images/icons/JEIcon_Release.png",
  }
  .to_string()
}

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![
    mcp_tool!(
      "retrieve_instance_list",
      retrieve_instance_list,
      "Primary tool for listing local Minecraft instances. Returns instance IDs and metadata for selecting an instance."
    ),
    mcp_tool!(
      "create_instance",
      "Create a Minecraft instance and schedule required client/mod-loader downloads. Resolves game and loader metadata from version IDs.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Game directory display name from launcher config `localGameDirectories[].name`.")]
        directory_name: String,
        #[schemars(description = "Game directory path from launcher config `localGameDirectories[].dir`.")]
        directory_path: String,
        #[schemars(description = "New instance name. Must be unique under the selected game directory.")]
        name: String,
        #[schemars(description = "Optional instance description. Defaults to an empty string.")]
        description: Option<String>,
        #[schemars(description = "Optional instance icon source. Defaults to the standard icon for the selected game version type.")]
        icon_src: Option<String>,
        #[schemars(description = "Minecraft game version ID, for example `1.21.5`.")]
        game_version: String,
        #[schemars(description = "Optional mod loader type: `unknown`, `fabric`, `forge`, `legacyforge`, `neoforge`, or `quilt`. Defaults to `unknown`.")]
        mod_loader_type: Option<String>,
        #[schemars(description = "Optional exact mod loader version. If omitted, the first stable loader version is used.")]
        mod_loader_version: Option<String>,
        #[schemars(description = "Optional OptiFine patch or filename returned by `fetch_optifine_version_list`. Omit for no OptiFine.")]
        optifine_version: Option<String>,
        #[schemars(description = "Optional local modpack archive path.")]
        modpack_path: Option<String>,
        #[schemars(description = "Whether to install Fabric API when creating a Fabric instance. Defaults to true.")]
        is_install_fabric_api: Option<bool>,
        #[schemars(description = "Whether to install QFAPI/QSL when creating a Quilt instance. Defaults to true.")]
        is_install_qf_api: Option<bool>,
      } => async move {
        if params.name.trim().is_empty()
          || params.directory_name.trim().is_empty()
          || params.directory_path.trim().is_empty()
        {
          return Err(InstanceError::InvalidSourcePath.into());
        }

        let game = fetch_game_version_specific(app.clone(), params.game_version.clone()).await?;
        let mod_loader_type = parse_mod_loader_type(params.mod_loader_type)?;
        let mod_loader = resolve_mod_loader(
          app.clone(),
          params.game_version.clone(),
          mod_loader_type,
          params.mod_loader_version,
        )
        .await?;
        let optifine =
          resolve_optifine(app.clone(), params.game_version, params.optifine_version).await?;
        let icon_src = params
          .icon_src
          .filter(|icon_src| !icon_src.trim().is_empty())
          .unwrap_or_else(|| default_icon_for_game_type(&game.game_type));

        create_instance(
          app,
          GameDirectory {
            name: params.directory_name,
            dir: PathBuf::from(params.directory_path),
          },
          params.name,
          params.description.unwrap_or_default(),
          icon_src,
          game,
          mod_loader,
          optifine,
          params.modpack_path,
          params.is_install_fabric_api.or(Some(true)),
          params.is_install_qf_api.or(Some(true)),
        )
        .await
      }
    ),
    mcp_tool!(
      "retrieve_world_list",
      retrieve_world_list,
      "Retrieve local world metadata for a Minecraft instance.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      "retrieve_world_details",
      retrieve_world_details,
      "Retrieve detailed level.dat data for a local world in a Minecraft instance.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID returned by `retrieve_instance_list`.")]
        instance_id: String,
        #[schemars(description = "World directory name returned by `retrieve_world_list`.")]
        world_name: String,
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
        retrieve_game_server_list(app, params.instance_id, true).await
      }
    ),
    mcp_tool!(
      "delete_game_server",
      "Delete a saved multiplayer server from a Minecraft instance's server list. Requires confirm=true.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID returned by `retrieve_instance_list`.")]
        instance_id: String,
        #[schemars(description = "Server address returned as `ip` by `retrieve_game_server_list`.")]
        server_addr: String,
        #[schemars(description = "Must be true to confirm deleting this saved server entry.")]
        confirm: bool,
      } => async move {
        if !params.confirm {
          return Err(MCPError::ToolNeedsConfirmation.into());
        }

        delete_game_server(app, params.instance_id, params.server_addr).await
      }
    ),
    mcp_tool!(
      "add_game_server",
      add_game_server,
      "Add a saved multiplayer server to a Minecraft instance's server list.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID returned by `retrieve_instance_list`.")]
        instance_id: String,
        #[schemars(description = "Server address, for example `mc.example.com` or `127.0.0.1:25565`.")]
        server_addr: String,
        #[schemars(description = "Display name saved for this server entry.")]
        server_name: String,
      }
    ),
    mcp_tool!(
      sync "retrieve_instance_game_config",
      retrieve_instance_game_config,
      "Retrieve the effective game configuration for a Minecraft instance. If the instance does not use a dedicated config, this returns the global game configuration currently applied to it.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID returned by `retrieve_instance_list`.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      "restore_instance_game_config",
      restore_instance_game_config,
      "Restore a Minecraft instance's dedicated game configuration to the current global game configuration.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID returned by `retrieve_instance_list`.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      "delete_instance",
      "Delete a Minecraft instance and its instance directory. Requires confirm=true.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID returned by `retrieve_instance_list`.")]
        instance_id: String,
        #[schemars(description = "Must be true to confirm deleting this instance and its files.")]
        confirm: bool,
      } => async move {
        if !params.confirm {
          return Err(MCPError::ToolNeedsConfirmation.into());
        }

        delete_instance(app, params.instance_id)
      }
    ),
    mcp_tool!(
      "rename_instance",
      rename_instance,
      "Rename a Minecraft instance and return its new instance path.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID returned by `retrieve_instance_list`.")]
        instance_id: String,
        #[schemars(description = "New display name for the instance.")]
        new_name: String,
      }
    ),
    mcp_tool!(
      "create_launch_desktop_shortcut",
      "Create a desktop shortcut that launches a Minecraft instance. Uses the instance custom icon by default.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID returned by `retrieve_instance_list`.")]
        instance_id: String,
        #[schemars(description = "Shortcut icon source. Omit to use `custom`; pass an asset path to use a built-in icon.")]
        icon_src: Option<String>,
      } => async move {
        create_launch_desktop_shortcut(
          app,
          params.instance_id,
          params.icon_src.unwrap_or_else(|| "custom".to_string()),
        )
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
        let mut mods = retrieve_local_mod_list(app, params.instance_id).await?;
        // strip icon binary payload in MCP responses to reduce context length.
        for mod_info in &mut mods {
          mod_info.icon_src = Default::default();
        }
        Ok(mods)
      }
    ),
    mcp_tool!(
      "retrieve_resource_pack_list",
      retrieve_resource_pack_list,
      "Retrieve resource packs for a Minecraft instance.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      "retrieve_server_resource_pack_list",
      retrieve_server_resource_pack_list,
      "Retrieve server resource packs for a Minecraft instance.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      sync "retrieve_schematic_list",
      retrieve_schematic_list,
      "Retrieve schematics for a Minecraft instance.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      sync "retrieve_shader_pack_list",
      retrieve_shader_pack_list,
      "Retrieve shader packs for a Minecraft instance.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Minecraft instance ID.")]
        instance_id: String,
      }
    ),
    mcp_tool!(
      sync "retrieve_screenshot_list",
      retrieve_screenshot_list,
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
        toggle_mod_by_extension(std::path::PathBuf::from(params.file_path), params.enable)
      }
    ),
  ]
}
