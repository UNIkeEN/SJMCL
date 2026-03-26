use crate::launcher_config::models::{LauncherConfig, ProxyType};
use reqwest_middleware::{ClientBuilder as ClientWithMiddlewareBuilder, ClientWithMiddleware};
use reqwest_retry::policies::ExponentialBackoff;
use reqwest_retry::RetryTransientMiddleware;
use reqwest_retry::{
  default_on_request_failure, default_on_request_success, Retryable, RetryableStrategy,
};
use std::sync::Mutex;
use std::time::Duration;
use tauri::http::StatusCode;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest::header::HeaderMap;
use tauri_plugin_http::reqwest::{Client, ClientBuilder, Proxy};
use url::Url;

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

/// Check whether the current IP is located in mainland China.
///
/// This function queries two Cloudflare trace endpoints in parallel.
/// If either endpoint reports `loc=CN`, the IP is considered to be in mainland China.
/// The detection result is cached into the launcher config.
///
/// # Arguments
///
/// * `app` - The Tauri AppHandle.
///
/// # Returns
///
/// * `Some(true)` if either endpoint reports mainland China.
/// * `Some(false)` if both endpoints report non-mainland China.
/// * `None` if both detection requests fail.
pub async fn is_china_mainland_ip(app: &AppHandle) -> Option<bool> {
  let client = app.state::<Client>();

  async fn fetch_and_extract_loc(client: &Client, url: &str) -> Option<String> {
    let resp = client.get(url).send().await.ok()?;
    let text = resp.text().await.ok()?;
    let loc_line = text.lines().find(|line| line.starts_with("loc="))?;
    let loc = loc_line.split('=').nth(1)?.trim();
    log::info!("Check location from {}, return {}", url, loc);
    Some(loc.to_string())
  }

  let (loc1, loc2) = tokio::join!(
    fetch_and_extract_loc(&client, "https://cloudflare.com/cdn-cgi/trace"),
    fetch_and_extract_loc(&client, "https://www.cloudflare-cn.com/cdn-cgi/trace")
  );
  let result = loc1.as_deref() == Some("CN") || loc2.as_deref() == Some("CN");

  let config_binding = app.state::<Mutex<LauncherConfig>>();
  match config_binding.lock() {
    Ok(mut config_state) => {
      let _ = config_state.partial_update(
        app,
        "basic_info.is_china_mainland_ip",
        &serde_json::to_string(&result).unwrap_or("false".to_string()),
      );
    }
    Err(_) => return Some(false),
  }

  Some(result)
}

/// Normalizes a URL string for semantic equality comparison, including:
/// - Lowercasing the scheme and the host (ref to RFC 3986, impl by Url::parse)
/// - Removing trailing slashes from paths (except for root `/`)
/// - Removing default ports (e.g. 80 for HTTP, 443 for HTTPS)
///
/// # Arguments
///
/// * `input` - The URL string to normalize.
///
/// # Returns
///
/// A normalized URL string suitable for direct string comparison.
/// If parsing fails, the original input string is returned unchanged.
pub fn normalize_url(input: &str) -> String {
  let url = match Url::parse(input) {
    Ok(url) if !url.cannot_be_a_base() && url.host_str().is_some() => url,
    _ => return input.to_string(),
  };

  // remove trailing slash except for root
  let mut path = url.path().to_string();
  if path != "/" {
    path = path.trim_end_matches('/').to_string();
  }

  // remove default port(e.g. 80 for HTTP, 443 for HTTPS)
  let port = match (url.port(), url.port_or_known_default()) {
    (Some(p), Some(default)) if p == default => None,
    (p, _) => p,
  };

  let mut normalized = match Url::parse(&format!("{}://{}", url.scheme(), url.host_str().unwrap()))
  {
    Ok(u) => u,
    Err(_) => return input.to_string(),
  };

  let _ = normalized.set_port(port);
  normalized.set_path(&path);
  normalized.set_query(url.query());
  normalized.set_fragment(url.fragment());

  normalized.to_string()
}
