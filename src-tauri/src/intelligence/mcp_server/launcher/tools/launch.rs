use crate::intelligence::mcp_server::launcher::McpContext;
use crate::mcp_tool;
use rmcp::handler::server::tool::ToolRoute;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![mcp_tool!(
    deeplink "launch_instance",
    "Launch a specific Minecraft instance by its instance_id via SJMCL deeplink. Before launch, check and update, if user requested, the selected player in launcher configuration.",
    |params| { instance_id: String } => format!(
      "sjmcl://launch?id={}",
      urlencoding::encode(&params.instance_id)
    )
  )]
}
