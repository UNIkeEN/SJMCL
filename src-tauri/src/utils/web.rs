use reqwest_retry::{
  default_on_request_failure, default_on_request_success, Retryable, RetryableStrategy,
};
use tauri::http::StatusCode;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest::{header::HeaderMap, Client, ClientBuilder, Proxy};

use crate::launcher_config::models::{LauncherConfig, ProxyType};
use reqwest_middleware::ClientBuilder as ClientWithMiddlewareBuilder;
use reqwest_middleware::ClientWithMiddleware;
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};
use std::sync::Mutex;
use std::time::Duration;

/// Builds a reqwest client with SJMCL version header and proxy support.
/// Defaults to 10s timeout.
///
/// # Arguments
///
/// * `app` - The Tauri AppHandle.
/// * `use_version_header` - Whether to include the SJMCL version header.
/// * `use_proxy` - Whether to use the proxy settings from the config.
///
/// TODO: support more custom config from reqwest::Config
/// FIXME: Seems like hyper will panic if this client is shared across threads.
///
/// # Returns
///
/// A reqwest::Client instance.
///
/// # Example
///
/// ```rust
/// let client = build_sjmcl_client(&app, true, true);
/// ```
pub fn build_sjmcl_client(app: &AppHandle, use_version_header: bool, use_proxy: bool) -> Client {
  let mut builder = ClientBuilder::new()
    .timeout(Duration::from_secs(10))
    .tcp_keepalive(Duration::from_secs(10));

  if let Ok(config) = app.state::<Mutex<LauncherConfig>>().lock() {
    if use_version_header {
      // According to the User-Agent requirements of mozilla and BMCLAPI, the User-Agent is set to start with ${NAME}/${VERSION}
      // https://github.com/MCLF-CN/docs/issues/2
      // https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Headers/User-Agent
      if let Ok(header_value) = format!("SJMCL/{}", &config.basic_info.launcher_version).parse() {
        let mut headers = HeaderMap::new();
        headers.insert("User-Agent", header_value);
        builder = builder.default_headers(headers);
      }
    }

    if use_proxy && config.download.proxy.enabled {
      let proxy_cfg = &config.download.proxy;
      let proxy_url = match proxy_cfg.selected_type {
        ProxyType::Http => format!("http://{}:{}", proxy_cfg.host, proxy_cfg.port),
        ProxyType::Socks => format!("socks5h://{}:{}", proxy_cfg.host, proxy_cfg.port),
      };

      if let Ok(proxy) = Proxy::all(&proxy_url) {
        builder = builder.proxy(proxy);
      }
    }
  }

  builder.build().unwrap_or_else(|_| Client::new())
}

struct SJMCLRetryableStrategy;

impl RetryableStrategy for SJMCLRetryableStrategy {
  fn handle(
    &self,
    res: &Result<tauri_plugin_http::reqwest::Response, reqwest_middleware::Error>,
  ) -> Option<reqwest_retry::Retryable> {
    match res {
      // retry if 403
      Ok(success) if success.status() == StatusCode::FORBIDDEN => Some(Retryable::Transient),
      // otherwise do not retry a successful request
      Ok(success) => default_on_request_success(success),
      // but maybe retry a request failure
      Err(error) if matches!(error.status(), Some(StatusCode::FORBIDDEN)) => {
        Some(Retryable::Transient)
      }
      Err(error) if error.is_request() => Some(Retryable::Transient),
      Err(error) => default_on_request_failure(error),
    }
  }
}

pub fn with_retry(client: Client) -> ClientWithMiddleware {
  ClientWithMiddlewareBuilder::new(client)
    .with(RetryTransientMiddleware::new_with_policy_and_strategy(
      ExponentialBackoff::builder().build_with_total_retry_duration(Duration::from_secs(3600)),
      SJMCLRetryableStrategy {},
    ))
    .build()
}

pub async fn is_china_mainland_ip(app: &AppHandle) -> Option<bool> {
  let client = app.state::<Client>();

  let config_binding = app.state::<Mutex<LauncherConfig>>();

  let result = async {
    let resp = client
      .get("https://cloudflare.com/cdn-cgi/trace")
      .send()
      .await
      .ok()?;
    let text = resp.text().await.ok()?;
    let loc_pair = text.split('\n').find(|line| line.starts_with("loc="))?;
    let location = loc_pair.split('=').nth(1)?;
    Some(location == "CN")
  }
  .await
  .unwrap_or(false); // any failure → false

  match config_binding.lock() {
    Ok(mut config_state) => {
      let _ = config_state.partial_update(
        app,
        "basic_info.is_china_mainland_ip",
        &serde_json::to_string(&result).unwrap_or("false".to_string()),
      );
    }
    Err(_) => {
      return Some(false);
    }
  }

  Some(result)
}
