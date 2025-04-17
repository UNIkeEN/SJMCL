use tauri::{AppHandle, Error, LogicalSize, Size, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use url::Url;

pub async fn create_webview_window(
  app: &AppHandle,
  label: &str,
  url: Url,
  width: f64,
  height: f64,
  center: bool,
) -> Result<WebviewWindow, Error> {
  let window = WebviewWindowBuilder::new(app, label, WebviewUrl::External(url))
    .title("")
    .build()?;

  window.set_size(Size::Logical(LogicalSize::new(width, height)))?;

  if center {
    window.center()?;
  }

  Ok(window)
}
