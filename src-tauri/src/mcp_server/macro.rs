#[macro_export]
macro_rules! mcp_tool {
  (sync $name:expr, $command:path, $description:expr) => {{
    rmcp::handler::server::tool::ToolRoute::new_dyn(
      rmcp::model::Tool::new(
        $name,
        $description,
        rmcp::handler::server::tool::schema_for_type::<rmcp::model::JsonObject>(),
      ),
      move |context: rmcp::handler::server::tool::ToolCallContext<
        '_,
        $crate::mcp_server::McpContext,
      >| {
        use futures::FutureExt;

        async move {
          let app = context.service.app_handle.clone();
          $crate::mcp_server::command_result_to_tool_result($command(app))
        }
        .boxed()
      },
    )
  }};
  ($name:expr, $command:path, $description:expr) => {{
    rmcp::handler::server::tool::ToolRoute::new_dyn(
      rmcp::model::Tool::new(
        $name,
        $description,
        rmcp::handler::server::tool::schema_for_type::<rmcp::model::JsonObject>(),
      ),
      move |context: rmcp::handler::server::tool::ToolCallContext<
        '_,
        $crate::mcp_server::McpContext,
      >| {
        use futures::FutureExt;

        async move {
          let app = context.service.app_handle.clone();
          $crate::mcp_server::command_result_to_tool_result($command(app).await)
        }
        .boxed()
      },
    )
  }};
  (sync $name:expr, $command:path, $description:expr, { $($arg:ident : $ty:ty),* $(,)? }) => {{
    #[derive(::serde::Deserialize, ::schemars::JsonSchema)]
    struct __McpToolParams {
      $(pub $arg: $ty),*
    }

    rmcp::handler::server::tool::ToolRoute::new_dyn(
      rmcp::model::Tool::new(
        $name,
        $description,
        rmcp::handler::server::tool::schema_for_type::<__McpToolParams>(),
      ),
      move |context: rmcp::handler::server::tool::ToolCallContext<
        '_,
        $crate::mcp_server::McpContext,
      >| {
        use futures::FutureExt;

        async move {
          let mut context = context;
          let params: __McpToolParams = rmcp::handler::server::tool::parse_json_object(
            context.arguments.take().unwrap_or_default(),
          )?;
          let app = context.service.app_handle.clone();
          $crate::mcp_server::command_result_to_tool_result($command(app, $(params.$arg),*))
        }
        .boxed()
      },
    )
  }};
  ($name:expr, $command:path, $description:expr, { $($arg:ident : $ty:ty),* $(,)? }) => {{
    #[derive(::serde::Deserialize, ::schemars::JsonSchema)]
    struct __McpToolParams {
      $(pub $arg: $ty),*
    }

    rmcp::handler::server::tool::ToolRoute::new_dyn(
      rmcp::model::Tool::new(
        $name,
        $description,
        rmcp::handler::server::tool::schema_for_type::<__McpToolParams>(),
      ),
      move |context: rmcp::handler::server::tool::ToolCallContext<
        '_,
        $crate::mcp_server::McpContext,
      >| {
        use futures::FutureExt;

        async move {
          let mut context = context;
          let params: __McpToolParams = rmcp::handler::server::tool::parse_json_object(
            context.arguments.take().unwrap_or_default(),
          )?;
          let app = context.service.app_handle.clone();
          $crate::mcp_server::command_result_to_tool_result(
            $command(app, $(params.$arg),*).await,
          )
        }
        .boxed()
      },
    )
  }};
  ($name:expr, $description:expr, |$app:ident, $params:ident : $params_ty:ty| $call:expr) => {{
    rmcp::handler::server::tool::ToolRoute::new_dyn(
      rmcp::model::Tool::new(
        $name,
        $description,
        rmcp::handler::server::tool::schema_for_type::<rmcp::model::JsonObject>(),
      ),
      move |context: rmcp::handler::server::tool::ToolCallContext<
        '_,
        $crate::mcp_server::McpContext,
      >| {
        use futures::FutureExt;

        async move {
          let mut context = context;
          let $params: $params_ty = rmcp::handler::server::tool::parse_json_object(
            context.arguments.take().unwrap_or_default(),
          )?;
          let $app = context.service.app_handle.clone();
          $crate::mcp_server::command_result_to_tool_result($call.await)
        }
        .boxed()
      },
    )
  }};
  (raw $name:expr, $handler:path, $description:expr) => {{
    rmcp::handler::server::tool::ToolRoute::new_dyn(
      rmcp::model::Tool::new(
        $name,
        $description,
        rmcp::handler::server::tool::schema_for_type::<rmcp::model::JsonObject>(),
      ),
      move |context: rmcp::handler::server::tool::ToolCallContext<
        '_,
        $crate::mcp_server::McpContext,
      >| {
        use futures::FutureExt;
        $handler(context).boxed()
      },
    )
  }};
  (deeplink $name:expr, $description:expr, |$params:ident| { $($arg:ident : $ty:ty),* $(,)? } => $deeplink:expr) => {{
    #[derive(::serde::Deserialize, ::schemars::JsonSchema)]
    struct __McpToolParams {
      $(pub $arg: $ty),*
    }

    rmcp::handler::server::tool::ToolRoute::new_dyn(
      rmcp::model::Tool::new(
        $name,
        $description,
        rmcp::handler::server::tool::schema_for_type::<__McpToolParams>(),
      ),
      move |context: rmcp::handler::server::tool::ToolCallContext<
        '_,
        $crate::mcp_server::McpContext,
      >| {
        use futures::FutureExt;

        async move {
          use tauri_plugin_opener::OpenerExt;

          let mut context = context;
          let $params: __McpToolParams = rmcp::handler::server::tool::parse_json_object(
            context.arguments.take().unwrap_or_default(),
          )?;
          let app = context.service.app_handle.clone();
          let deeplink: String = $deeplink;
          app
            .opener()
            .open_url(&deeplink, None::<&str>)
            .map_err(|e| rmcp::ErrorData::internal_error(e.to_string(), None))?;

          Ok(rmcp::model::CallToolResult::success(vec![
            rmcp::model::Content::text(format!("Opened deeplink: {deeplink}")),
          ]))
        }
        .boxed()
      },
    )
  }};
  (deeplink $name:expr, $description:expr, $deeplink:expr) => {{
    rmcp::handler::server::tool::ToolRoute::new_dyn(
      rmcp::model::Tool::new(
        $name,
        $description,
        rmcp::handler::server::tool::schema_for_type::<rmcp::model::JsonObject>(),
      ),
      move |context: rmcp::handler::server::tool::ToolCallContext<
        '_,
        $crate::mcp_server::McpContext,
      >| {
        use futures::FutureExt;

        async move {
          use tauri_plugin_opener::OpenerExt;

          let app = context.service.app_handle.clone();
          let deeplink: String = $deeplink;
          app
            .opener()
            .open_url(&deeplink, None::<&str>)
            .map_err(|e| rmcp::ErrorData::internal_error(e.to_string(), None))?;

          Ok(rmcp::model::CallToolResult::success(vec![
            rmcp::model::Content::text(format!("Opened deeplink: {deeplink}")),
          ]))
        }
        .boxed()
      },
    )
  }};
}
