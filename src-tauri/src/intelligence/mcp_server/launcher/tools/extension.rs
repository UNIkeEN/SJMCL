use rmcp::handler::server::tool::ToolRoute;

use crate::extension::commands::{delete_extension, retrieve_extension_list};
use crate::intelligence::mcp_server::launcher::McpContext;
use crate::intelligence::mcp_server::model::MCPError;
use crate::mcp_tool;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![
    mcp_tool!(
      "retrieve_extension_list",
      "Retrieve installed launcher extensions.",
      |app, _params: rmcp::model::JsonObject| async move {
        let mut extensions = retrieve_extension_list(app)?;
        for extension in &mut extensions {
          extension.icon_src = Default::default();
        }
        Ok(extensions)
      }
    ),
    mcp_tool!(
      "delete_extension",
      "Delete an installed launcher extension by identifier. Requires confirm=true.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "Extension identifier returned by `retrieve_extension_list`.")]
        identifier: String,
        #[schemars(description = "Must be true to confirm deleting this extension.")]
        confirm: bool,
      } => async move {
        if !params.confirm {
          return Err(MCPError::ToolNeedsConfirmation.into());
        }

        delete_extension(app, params.identifier)
      }
    ),
  ]
}
