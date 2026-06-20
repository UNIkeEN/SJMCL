use rmcp::handler::server::tool::ToolRoute;

use crate::account::commands::*;
use crate::account::helpers::import::misc::ACCESS_TOKEN_EXPIRED;
use crate::account::models::{AccountError, Player, PresetRole};
use crate::intelligence::mcp_server::launcher::McpContext;
use crate::intelligence::mcp_server::model::MCPError;
use crate::mcp_tool;

fn strip_sensitive_player_info(players: &mut [Player]) {
  for player in players {
    player.avatar = Vec::new();
    player.textures = Vec::new();
    player.access_token = None;
    player.refresh_token = None;
  }
}

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![
    mcp_tool!(
      "retrieve_player_list",
      "Retrieve all Minecraft account(player) profiles stored in the launcher, including offline, Microsoft and 3rd-party authenticated accounts.",
      |app, _params: rmcp::model::JsonObject| async move {
        let mut players = retrieve_player_list(app)?;
        // remove token and base64 texture data in MCP responses to reduce context length.
        strip_sensitive_player_info(&mut players);
        Ok(players)
      }
    ),
    mcp_tool!(
      "add_player_offline",
      add_player_offline,
      "Add a new offline Minecraft player account to the launcher. Offline accounts do not require Microsoft or 3rd-party authentication and can be used for local/LAN play.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "The player username for the offline account.")]
        username: String,
        #[schemars(description = "Optional UUID for the player. Leave empty to auto-generate a deterministic UUID based on the username.")]
        #[serde(default)]
        uuid: String,
      }
    ),
    mcp_tool!(
      "select_player",
      "A shortcut tool to update selected player by its ID in launcher config, which will be used for Minecraft game launches. Player ID can be obtained from retrieve_player_list tool.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Player profile ID returned by `retrieve_player_list`.")]
        id: String,
      } => async move {
        let id = params.id.trim();
        let value =
          serde_json::to_string(&id).map_err(|e| sjmcl_types::error::SJMCLError(e.to_string()))?;
        crate::launcher_config::commands::update_launcher_config(
          app,
          "states.shared.selectedPlayerId".to_string(),
          value,
        )
      }
    ),
    mcp_tool!(
      "update_player_skin_offline_preset",
      "Update an offline Minecraft player's skin to a built-in preset role. Only offline players are supported. Player ID can be obtained from retrieve_player_list tool.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Offline player profile ID returned by `retrieve_player_list`.")]
        player_id: String,
        #[schemars(description = "Built-in skin preset role. Accepted values: `steve`, `alex`.")]
        preset_role: String,
      } => async move {
        let preset_role = match params.preset_role.trim().to_ascii_lowercase().as_str() {
          "steve" => PresetRole::Steve,
          "alex" => PresetRole::Alex,
          _ => return Err(AccountError::Invalid.into()),
        };

        update_player_skin_offline_preset(
          app,
          params.player_id,
          preset_role,
        )
      }
    ),
    mcp_tool!(
      "delete_player",
      "Delete a Minecraft player account from the launcher by player ID. Requires confirm=true. Player ID can be obtained from retrieve_player_list tool.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Player profile ID returned by `retrieve_player_list`.")]
        player_id: String,
        #[schemars(description = "Must be true to confirm deleting this player account.")]
        confirm: bool,
      } => async move {
        if !params.confirm {
          return Err(MCPError::ToolNeedsConfirmation.into());
        }

        delete_player(app, params.player_id).await
      }
    ),
    mcp_tool!(
      "refresh_player",
      refresh_player,
      "Refresh authentication for a Microsoft or 3rd-party player account. Offline players cannot be refreshed. Player ID can be obtained from retrieve_player_list tool.",
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Microsoft or 3rd-party player profile ID returned by `retrieve_player_list`.")]
        player_id: String,
      }
    ),
    mcp_tool!(
      sync "retrieve_auth_server_list",
      retrieve_auth_server_list,
      "Retrieve configured 3rd-party authentication servers."
    ),
    mcp_tool!(
      "add_auth_server",
      "Fetch, validate, and add a 3rd-party authentication server from a user-provided URL.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Authentication server URL or host to validate and add.")]
        auth_url: String,
      } => async move {
        let auth_server = fetch_auth_server(app.clone(), params.auth_url).await?;
        add_auth_server(app, auth_server.auth_url).await
      }
    ),
    mcp_tool!(
      "delete_auth_server",
      "Delete a 3rd-party authentication server by URL. Requires confirm=true. This also removes all players using that server.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Authentication server URL returned by `retrieve_auth_server_list`.")]
        url: String,
        #[schemars(description = "Must be true to confirm deleting this auth server and all players using it.")]
        confirm: bool,
      } => async move {
        if !params.confirm {
          return Err(MCPError::ToolNeedsConfirmation.into());
        }

        delete_auth_server(app, params.url)
      }
    ),
    mcp_tool!(
      "import_other_launcher_account_info",
      "Retrieve account information from another launcher and import it directly into SJMCL. Supported launcher_type values: `HMCL`, `MultiMC`.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Source launcher type. Accepted values: `HMCL`, `MultiMC`.")]
        launcher_type: String,
      } => async move {
        let launcher_type = match params.launcher_type.trim().to_ascii_lowercase().as_str() {
          "hmcl" => crate::account::helpers::import::ImportLauncherType::HMCL,
          "multimc" => crate::account::helpers::import::ImportLauncherType::MultiMC,
          _ => return Err(AccountError::Invalid.into()),
        };

        let (players, auth_servers) =
          retrieve_other_launcher_account_info(app.clone(), launcher_type).await?;

        let mut imported_players = Vec::new();
        let mut expired_player_names = Vec::new();
        for player in players {
          if player.access_token.as_deref() == Some(ACCESS_TOKEN_EXPIRED) {
            expired_player_names.push(player.name);
          } else {
            imported_players.push(player);
          }
        }

        let imported_player_count = imported_players.len();
        let imported_auth_server_count = auth_servers.len();
        let imported_player_names = imported_players
          .iter()
          .map(|player| player.name.clone())
          .collect::<Vec<_>>();
        let expired_player_count = expired_player_names.len();

        import_external_account_info(app.clone(), imported_players, auth_servers).await?;

        Ok(serde_json::json!({
          "importedPlayers": imported_player_count,
          "importedPlayerNames": imported_player_names,
          "importedAuthServers": imported_auth_server_count,
          "expiredPlayers": expired_player_count,
          "expiredPlayerNames": expired_player_names,
        }))
      }
    ),
  ]
}
