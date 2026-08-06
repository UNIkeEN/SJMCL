use sjmcl_types::error::{SJMCLError, SJMCLResult};
use tauri::utils::config::WindowConfig;
use tauri::{AppHandle, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use url::Url;

#[cfg(target_os = "macos")]
use tauri::{TitleBarStyle, utils::config::LogicalPosition};

#[cfg(target_os = "windows")]
use tauri_plugin_decorum::WebviewWindowExt;

/// Retrieves a window configuration defined in `tauri.conf.json`.
///
/// # Arguments
///
/// * `app` - The Tauri AppHandle.
/// * `label` - The label of the `WindowConfig` in `tauri.conf.json`.
///
/// # Examples
///
/// ```rust
/// let config = get_webview_window_config(app, "game_log")?;
/// ```
///
/// # Returns
///
/// A clone of the requested `WindowConfig`.
///
/// # Errors
///
/// Returns an error if no configuration with the given label exists.
pub fn get_webview_window_config(app: &AppHandle, label: &str) -> SJMCLResult<WindowConfig> {
  let window_config = app
    .config()
    .app
    .windows
    .iter()
    .find(|cfg| cfg.label == label)
    .ok_or_else(|| SJMCLError(format!("Config label '{}' not found", label)))?;

  Ok(window_config.clone())
}

/// Creates a new webview window using the configuration defined in `tauri.conf.json`
/// under the given `config_label`, and uses the provided `label` as the window identifier.
///
/// Tauri enforces a strict rule: [**window labels must be unique**](https://docs.rs/tauri/2.0.0-rc/tauri/webview/struct.WebviewWindowBuilder.html#method.from_config).
/// This function allows reusing a predefined `WindowConfig` while specifying a custom
/// `label` to avoid conflicts. This is particularly useful when you want to create
/// multiple windows with the same configuration but different identifiers.
///
/// # Arguments
///
/// * `app` - The Tauri AppHandle.
/// * `label` - The label of the new window.
/// * `config_label` - The label of the configuration template in `tauri.conf.json`.
/// * `url` - An optional URL that overrides the template configuration.
/// * `custom_overlaid` - Whether to apply the custom overlaid titlebar configuration.
///
/// # Examples
///
/// ```rust
/// let window = create_webview_window(app, "game_log_1", "game_log", None, true).await?;
/// ```
///
/// # Returns
///
/// The created `WebviewWindow`.
///
/// # Errors
///
/// Returns an error if the configuration template cannot be found or the window cannot be created.
pub async fn create_webview_window(
  app: &AppHandle,
  label: &str,
  config_label: &str,
  url: Option<Url>,
  custom_overlaid: bool,
) -> SJMCLResult<WebviewWindow> {
  let mut config = get_webview_window_config(app, config_label)?;
  config.label = label.to_string();
  if let Some(url) = url {
    config.url = WebviewUrl::External(url);
  }

  create_webview_window_with_config(app, config, custom_overlaid).await
}

/// Creates a window using the provided configuration.
///
/// When `custom_overlaid` is enabled, its titlebar settings override the
/// corresponding fields in `config`.
///
/// # Arguments
///
/// * `app` - The Tauri AppHandle.
/// * `config` - The window configuration.
/// * `custom_overlaid` - Whether to apply the custom overlaid titlebar configuration.
///
/// # Examples
///
/// ```rust
/// let window = create_webview_window_with_config(app, config, true).await?;
/// ```
///
/// # Returns
///
/// The created `WebviewWindow`.
///
/// # Errors
///
/// Returns an error if the window cannot be created.
pub async fn create_webview_window_with_config(
  app: &AppHandle,
  mut config: WindowConfig,
  custom_overlaid: bool,
) -> SJMCLResult<WebviewWindow> {
  if custom_overlaid {
    config.min_width.get_or_insert(800.0);
    config.min_height.get_or_insert(550.0);

    #[cfg(not(target_os = "macos"))]
    {
      config.decorations = false;
    }

    #[cfg(target_os = "linux")]
    {
      config.transparent = true;
    }

    #[cfg(target_os = "macos")]
    {
      config.decorations = true;
      config.title_bar_style = TitleBarStyle::Overlay;
      config.hidden_title = true;
      config.traffic_light_position = Some(LogicalPosition { x: 10.0, y: 12.0 });
    }
  }

  #[allow(unused_variables)]
  let window = WebviewWindowBuilder::from_config(app, &config)
    .map_err(SJMCLError::from)?
    .build()
    .map_err(SJMCLError::from)?;

  #[cfg(target_os = "windows")]
  if custom_overlaid && let Err(e) = window.create_overlay_titlebar() {
    log::warn!("Failed to setup native windows caption buttons: {e}");
  }

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
