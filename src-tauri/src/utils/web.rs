use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest::{header::HeaderMap, Client, ClientBuilder, Proxy};

use crate::launcher_config::models::{LauncherConfig, ProxyType};

pub fn build_sjmcl_client(
  app: &AppHandle,
  use_version_header: bool,
  use_proxy: bool,
  // TODO: support more custom config from reqwest::Config
) -> Client {
  // default builder (with 10s timeout)
  let mut builder = ClientBuilder::new().timeout(Duration::from_secs(10));

  if let Ok(config) = app.state::<Mutex<LauncherConfig>>().lock() {
    // SJMCL version header
    if use_version_header {
      if let Ok(header_value) = format!("SJMCL {}", &config.basic_info.launcher_version).parse() {
        let mut headers = HeaderMap::new();
        headers.insert("User-Agent", header_value);
        builder = builder.default_headers(headers);
      }
    }

    // add proxy params
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
