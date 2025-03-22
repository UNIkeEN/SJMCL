use crate::{account::models::AccountError, error::SJMCLResult};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, LogicalSize, Size, WebviewUrl, WebviewWindowBuilder};
use url::Url;

pub async fn create_auth_webview(
  app: &AppHandle,
  verification_url: Url,
) -> SJMCLResult<(tauri::WebviewWindow, Arc<Mutex<bool>>)> {
  let is_cancelled = Arc::new(Mutex::new(false));
  let cancelled_clone = Arc::clone(&is_cancelled);

  let auth_webview = WebviewWindowBuilder::new(app, "", WebviewUrl::External(verification_url))
    .title("")
    .build()
    .map_err(|_| AccountError::NetworkError)?;

  auth_webview.set_size(Size::Logical(LogicalSize::new(650.0, 500.0)))?;
  auth_webview.center()?;
  auth_webview.on_window_event(move |event| {
    if let tauri::WindowEvent::Destroyed = event {
      *cancelled_clone.lock().unwrap() = true;
    }
  });

  Ok((auth_webview, is_cancelled))
}
