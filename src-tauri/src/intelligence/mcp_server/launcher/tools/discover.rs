use crate::discover::helpers::mc_news::{fetch_mc_news_page, MC_NEWS_ENDPOINT};
use crate::intelligence::mcp_server::launcher::McpContext;
use crate::mcp_tool;
use crate::utils::web::with_retry;
use rmcp::handler::server::tool::ToolRoute;
use tauri::{Manager, State};
use tauri_plugin_http::reqwest;

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![mcp_tool!(
    "fetch_minecraft_official_news",
    "Fetch official Minecraft news with cursor pagination.",
    |app, params|
    #[serde(deny_unknown_fields)]
    {
      #[schemars(description = "Cursor for the next page. Omit on the first request. To load more, pass the previous response's `next`.")]
      cursor: Option<u64>,
    } => async move {
      let client_state: State<reqwest::Client> = app.state();
      let client = with_retry(client_state.inner().clone());

      let (_, response) = fetch_mc_news_page(&client, MC_NEWS_ENDPOINT, params.cursor)
        .await
        .ok_or_else(|| crate::error::SJMCLError("failed to fetch Minecraft official news".to_string()))?;

      Ok::<_, crate::error::SJMCLError>(response)
    }
  )]
}
