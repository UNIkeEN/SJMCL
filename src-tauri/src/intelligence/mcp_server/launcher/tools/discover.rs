use rmcp::handler::server::tool::ToolRoute;
use serde::Deserialize;
use tauri::{Manager, State};
use tauri_plugin_http::reqwest;

use crate::discover::commands::{fetch_news_post_summaries, fetch_news_sources_info};
use crate::discover::helpers::mc_news::{MC_NEWS_ENDPOINT, fetch_mc_news_page};
use crate::discover::models::NewsPostRequest;
use crate::intelligence::mcp_server::launcher::McpContext;
use crate::mcp_tool;
use crate::utils::web::with_retry;

#[derive(Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct McpNewsPostRequest {
  #[schemars(description = "News source endpoint URL returned by `fetch_news_sources_info`.")]
  url: String,
  #[schemars(
    description = "Cursor for this source. Omit on the first request; use the previous response's `cursors[url]` value to load more."
  )]
  cursor: Option<u64>,
}

pub fn tool_routes() -> Vec<ToolRoute<McpContext>> {
  vec![
    mcp_tool!(
      "fetch_news_sources_info",
      fetch_news_sources_info,
      "Retrieve configured community news source metadata, including endpoint URLs used by fetch_news_post_summaries."
    ),
    mcp_tool!(
      "fetch_news_post_summaries",
      "Fetch news post summaries from one or more community news source endpoints with cursor pagination. Use fetch_news_sources_info first to get source endpoint URLs. To load more, pass each source's previous response cursor from `cursors[url]` into that request's `cursor` field.",
      |app, params|
      #[serde(deny_unknown_fields)]
      {
        #[schemars(description = "News source requests.")]
        requests: Vec<McpNewsPostRequest>,
      } => async move {
        let requests = params
          .requests
          .into_iter()
          .map(|request| NewsPostRequest {
            url: request.url,
            cursor: request.cursor,
          })
          .collect();

        fetch_news_post_summaries(app, requests).await
      }
    ),
    mcp_tool!(
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
          .ok_or_else(|| sjmcl_types::error::SJMCLError("failed to fetch Minecraft official news".to_string()))?;

        Ok::<_, sjmcl_types::error::SJMCLError>(response)
      }
    ),
  ]
}
