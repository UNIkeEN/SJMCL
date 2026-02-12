mod account;
mod debug;
mod instance;
mod launch;
mod launcher_config;
mod resource;

use crate::mcp_server::McpContext;
use rmcp::handler::server::tool::ToolRoute;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  let mut routes = Vec::new();

  routes.extend(launcher_config::tool_routes());
  routes.extend(account::tool_routes());
  routes.extend(instance::tool_routes());
  routes.extend(launch::tool_routes());
  routes.extend(resource::tool_routes());
  routes.extend(debug::tool_routes());

  routes
}
