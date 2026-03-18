#![cfg(windows)]
// Inspired by https://github.com/clearlysid/tauri-plugin-decorum
use tauri::{Runtime, WebviewWindow};

const WINDOWS_OVERLAY_CONTROLS_SCRIPT: &str = include_str!("windows_overlay_controls.js");

pub fn setup_windows_caption_buttons<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
  window.set_decorations(false)?;
  let _ = window.eval(WINDOWS_OVERLAY_CONTROLS_SCRIPT);
  Ok(())
}
