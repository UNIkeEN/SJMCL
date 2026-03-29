use crate::intelligence::mcp_server::launcher::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::ToolRoute;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![mcp_tool!(
    "echo_text",
    "Echo the provided text. Demonstrates arbitrary Rust function tool wiring.",
    |_app, params|
    #[serde(deny_unknown_fields)]
    {
      #[schemars(description = "Text returned verbatim in the tool result.")]
      text: String,
    } => async move { Ok::<_, crate::error::SJMCLError>(params.text) }
  )]
}
