use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest::{header::HeaderMap, Client, ClientBuilder, Proxy};

use crate::launcher_config::models::{LauncherConfig, ProxyType};

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
      if let Ok(header_value) = format!("SJMCL {}", &config.basic_info.launcher_version).parse() {
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

pub async fn is_china_mainland_ip(app: &AppHandle) -> Option<bool> {
  let client = app.state::<Client>();

  // retrieve the real IP
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
