#![cfg(windows)]

use std::collections::HashMap;
use std::mem;
use std::ptr::null_mut;
use std::sync::{LazyLock, Mutex};

use tauri::WebviewWindow;
use winapi::shared::minwindef::{LPARAM, LRESULT, UINT, WPARAM};
use winapi::shared::windef::{HWND, RECT};
use winapi::um::dwmapi::{DwmDefWindowProc, DwmExtendFrameIntoClientArea, MARGINS};
use winapi::um::winuser::{
  CallWindowProcW, DefWindowProcW, GetSystemMetrics, GetWindowLongPtrW, GetWindowRect,
  SetWindowLongPtrW, SetWindowPos, GWLP_WNDPROC, GWL_STYLE, HTCAPTION, HTCLIENT, HTCLOSE, HTHELP,
  HTLEFT, HTMAXBUTTON, HTMINBUTTON, HTRIGHT, HTSYSMENU, HTTOP, HTTOPLEFT, HTTOPRIGHT,
  SM_CXPADDEDBORDER, SM_CXSIZEFRAME, SM_CYSIZEFRAME, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE,
  SWP_NOSIZE, SWP_NOZORDER, WM_NCCALCSIZE, WM_NCDESTROY, WM_NCHITTEST, WM_SIZE, WNDPROC,
  WS_CAPTION, WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_SYSMENU, WS_THICKFRAME,
};

const CUSTOM_TITLEBAR_HEIGHT: i32 = 20;

static PREV_WNDPROC_MAP: LazyLock<Mutex<HashMap<isize, isize>>> =
  LazyLock::new(|| Mutex::new(HashMap::new()));

fn get_prev_wndproc(hwnd: HWND) -> Option<isize> {
  PREV_WNDPROC_MAP
    .lock()
    .ok()
    .and_then(|map| map.get(&(hwnd as isize)).copied())
}

fn remove_prev_wndproc(hwnd: HWND) -> Option<isize> {
  PREV_WNDPROC_MAP
    .lock()
    .ok()
    .and_then(|mut map| map.remove(&(hwnd as isize)))
}

unsafe fn apply_frame_extension(hwnd: HWND) {
  let margins = MARGINS {
    cxLeftWidth: 0,
    cxRightWidth: 0,
    cyTopHeight: CUSTOM_TITLEBAR_HEIGHT,
    cyBottomHeight: 0,
  };
  let _ = DwmExtendFrameIntoClientArea(hwnd, &margins);
}

unsafe fn get_point_from_lparam(lparam: LPARAM) -> (i32, i32) {
  let x = (lparam & 0xffff) as i16 as i32;
  let y = ((lparam >> 16) & 0xffff) as i16 as i32;
  (x, y)
}

unsafe fn hit_test_resize_border(hwnd: HWND, lparam: LPARAM) -> Option<LRESULT> {
  let mut rect: RECT = mem::zeroed();
  if GetWindowRect(hwnd, &mut rect) == 0 {
    return None;
  }

  let (x, y) = get_point_from_lparam(lparam);
  let frame_x = GetSystemMetrics(SM_CXSIZEFRAME) + GetSystemMetrics(SM_CXPADDEDBORDER);
  let frame_y = GetSystemMetrics(SM_CYSIZEFRAME) + GetSystemMetrics(SM_CXPADDEDBORDER);

  let on_left = x >= rect.left && x < rect.left + frame_x;
  let on_right = x <= rect.right && x > rect.right - frame_x;
  let on_top = y >= rect.top && y < rect.top + frame_y;

  if on_top && on_left {
    return Some(HTTOPLEFT as LRESULT);
  }
  if on_top && on_right {
    return Some(HTTOPRIGHT as LRESULT);
  }
  if on_left {
    return Some(HTLEFT as LRESULT);
  }
  if on_right {
    return Some(HTRIGHT as LRESULT);
  }
  if on_top {
    return Some(HTTOP as LRESULT);
  }

  None
}

fn is_caption_control_hit(hit: LRESULT) -> bool {
  matches!(
    hit as i32,
    HTCLOSE | HTMAXBUTTON | HTMINBUTTON | HTHELP | HTSYSMENU
  )
}

unsafe extern "system" fn custom_wndproc(
  hwnd: HWND,
  msg: UINT,
  wparam: WPARAM,
  lparam: LPARAM,
) -> LRESULT {
  match msg {
    // Remove the default title bar height while keeping non-client behavior.
    WM_NCCALCSIZE => {
      if wparam != 0 {
        return 0;
      }
    }
    WM_NCHITTEST => {
      // This mirrors the key native-behavior part relied on by decorum:
      // let DWM resolve caption button hit-tests first to preserve native controls.
      let mut dwm_hit: LRESULT = 0;
      let hr = DwmDefWindowProc(hwnd, msg, wparam, lparam, &mut dwm_hit);
      if hr >= 0 && is_caption_control_hit(dwm_hit) {
        return dwm_hit;
      }

      if let Some(border_hit) = hit_test_resize_border(hwnd, lparam) {
        return border_hit;
      }

      let mut rect: RECT = mem::zeroed();
      if GetWindowRect(hwnd, &mut rect) != 0 {
        let (_x, y) = get_point_from_lparam(lparam);
        if y < rect.top + CUSTOM_TITLEBAR_HEIGHT {
          return HTCAPTION as LRESULT;
        }
      }

      return HTCLIENT as LRESULT;
    }
    WM_SIZE => {
      apply_frame_extension(hwnd);
    }
    WM_NCDESTROY => {
      if let Some(prev_ptr) = remove_prev_wndproc(hwnd) {
        let _ = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, prev_ptr);
        let prev_proc: WNDPROC = mem::transmute(prev_ptr);
        return CallWindowProcW(prev_proc, hwnd, msg, wparam, lparam);
      }
    }
    _ => {}
  }

  if let Some(prev_ptr) = get_prev_wndproc(hwnd) {
    let prev_proc: WNDPROC = mem::transmute(prev_ptr);
    CallWindowProcW(prev_proc, hwnd, msg, wparam, lparam)
  } else {
    DefWindowProcW(hwnd, msg, wparam, lparam)
  }
}

pub fn setup_main_window_native_caption_buttons<R: tauri::Runtime>(
  window: &WebviewWindow<R>,
) -> tauri::Result<()> {
  let hwnd = window.hwnd()?.0 as HWND;

  unsafe {
    let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as usize;
    let style = style
      | WS_CAPTION as usize
      | WS_THICKFRAME as usize
      | WS_SYSMENU as usize
      | WS_MINIMIZEBOX as usize
      | WS_MAXIMIZEBOX as usize;
    let _ = SetWindowLongPtrW(hwnd, GWL_STYLE, style as isize);

    apply_frame_extension(hwnd);

    let prev_ptr = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, custom_wndproc as isize);
    if prev_ptr != 0 {
      if let Ok(mut map) = PREV_WNDPROC_MAP.lock() {
        map.insert(hwnd as isize, prev_ptr);
      }
    }

    let _ = SetWindowPos(
      hwnd,
      null_mut(),
      0,
      0,
      0,
      0,
      SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
    );
  }

  Ok(())
}
