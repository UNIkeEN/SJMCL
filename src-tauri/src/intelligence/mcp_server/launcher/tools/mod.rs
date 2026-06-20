mod account;
mod debug;
mod discover;
mod extension;
mod instance;
mod launch;
mod launcher_config;
mod resource;

use rmcp::handler::server::tool::ToolRoute;

use crate::intelligence::mcp_server::launcher::McpContext;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  let mut routes = Vec::new();

  routes.extend(launcher_config::tool_routes());
  routes.extend(account::tool_routes());
  routes.extend(discover::tool_routes());
  routes.extend(extension::tool_routes());
  routes.extend(instance::tool_routes());
  routes.extend(launch::tool_routes());
  routes.extend(resource::tool_routes());

  #[cfg(debug_assertions)]
  routes.extend(debug::tool_routes());

  routes
}
