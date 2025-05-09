use crate::error::{SJMCLError, SJMCLResult};
use tauri::{AppHandle, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_utils::config::WindowConfig;
use url::Url;

/// Creates a new webview window using the configuration defined in `tauri.conf.json`
/// under the given `config_label`, and uses the provided `label` as the window identifier.
///
/// Tauri enforces a strict rule: [**window labels must be unique**](https://docs.rs/tauri/2.0.0-rc/tauri/webview/struct.WebviewWindowBuilder.html#method.from_config). This function allows
/// reusing a predefined `WindowConfig` while specifying a custom `label` to avoid conflicts.
/// This is particularly useful when you want to create multiple windows with
/// the same configuration but different identifiers.
///
/// # Arguments
///
/// * `app` - The Tauri AppHandle.
/// * `label` - The exact label to use for the new window.
/// * `config_label` - The key used to fetch the `WindowConfig` from `tauri.conf.json`.
/// * `url` - Optional URL to override the `url` field in the configuration.
///
/// # Example
///
/// ```rust
/// let _ = create_webview_window(app, "game_output", "game_window")?;
/// ```
pub async fn create_webview_window(
  app: &AppHandle,
  label: &str,
  config_label: &str,
  url: Option<Url>,
) -> SJMCLResult<WebviewWindow> {
  let window_config = app
    .config()
    .app
    .windows
    .iter()
    .find(|cfg| cfg.label == config_label)
    .ok_or_else(|| SJMCLError(format!("Config label '{}' not found", config_label)))?;

  let mut window_config = window_config.clone();
  window_config.label = label.to_string();

  if let Some(custom_url) = url {
    window_config.url = WebviewUrl::External(custom_url);
  }

  let builder = WebviewWindowBuilder::from_config(app, &window_config).map_err(SJMCLError::from)?;
  let window = builder.build().map_err(SJMCLError::from)?;

  Ok(window)
}

/// Creates a new webview window using the provided `WindowConfig`.
/// It's useful when you want to construct the window configuration manually.
///
/// # Arguments
///
/// * `app` - The Tauri AppHandle.
/// * `config` - A fully defined `WindowConfig` object.
///
/// # Example
///
/// ```rust
/// let config = WindowConfig {
///     label: "custom".to_string(),
///     url: WebviewUrl::External(Url::parse("https://example.com").unwrap()),
///     width: 800.0,
///     height: 600.0,
///     ..Default::default()
/// };
///
/// let _ = create_webview_window_with_config(app, &config)?;
/// ```
pub async fn create_webview_window_with_config(
  app: &AppHandle,
  config: &WindowConfig,
) -> SJMCLResult<WebviewWindow> {
  let builder = WebviewWindowBuilder::from_config(app, config).map_err(SJMCLError::from)?;
  let window = builder.build().map_err(SJMCLError::from)?;

  Ok(window)
}

// pub async fn create_webview_window(
//   app: &AppHandle,
//   label: &str,
//   url: Url,
//   width: f64,
//   height: f64,
//   center: bool,
// ) -> Result<WebviewWindow, Error> {
//   let window = WebviewWindowBuilder::new(app, label, WebviewUrl::External(url))
//     .title("")
//     .build()?;

//   window.set_size(Size::Logical(LogicalSize::new(width, height)))?;

//   if center {
//     window.center()?;
//   }

//   Ok(window)
// }
