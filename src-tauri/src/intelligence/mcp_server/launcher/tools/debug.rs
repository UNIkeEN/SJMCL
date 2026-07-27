use rmcp::handler::server::tool::ToolRoute;

use crate::intelligence::mcp_server::launcher::McpContext;
use crate::mcp_tool;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![mcp_tool!(
    "echo_text",
    "Echo the provided text. Demonstrates arbitrary Rust function tool wiring.",
    |_app, params|
    #[serde(deny_unknown_fields)]
    {
      #[schemars(description = "Text returned verbatim in the tool result.")]
      text: String,
    } => async move { Ok::<_, sjmcl_types::error::SJMCLError>(params.text) }
  )]
}
