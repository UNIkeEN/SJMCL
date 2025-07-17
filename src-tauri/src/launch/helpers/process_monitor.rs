use crate::error::SJMCLResult;
use crate::instance::models::misc::Instance;
use crate::launch::constants::*;
use crate::launch::models::LaunchError;
use crate::launcher_config::models::{LauncherVisiablity, ProcessPriority};
use crate::utils::window::create_webview_window;
use std::collections::HashMap;
use std::fs::File;
use std::io::{prelude::*, BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::{
  atomic::{AtomicBool, Ordering},
  mpsc::Sender,
  Arc, Mutex,
};
use std::thread;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager};
use tokio;

struct OutputPipe<T: Read + Send + 'static> {
  app: AppHandle,
  out: T,
  label: String,
  start_time: Arc<Mutex<Option<Instant>>>,
  log_file: Arc<Mutex<File>>,
  display_log_window: bool,
  ready_tx: Sender<()>,
  game_ready_flag: Arc<AtomicBool>,
}

impl<T: Read + Send + 'static> OutputPipe<T> {
  fn listen_from_output(self) -> thread::JoinHandle<()> {
    thread::spawn(move || {
      let reader = BufReader::new(self.out);
      for line in reader.lines().map_while(Result::ok) {
        if self.display_log_window {
          let _ = self
            .app
            .emit_to(&self.label, GAME_PROCESS_OUTPUT_EVENT, &line);
        }
        writeln!(self.log_file.lock().unwrap(), "{line}").unwrap();
        // the first time when log contains 'render thread', 'lwjgl version', or 'lwjgl openal', send signal to launch command, close frontend modal.
        if !self.game_ready_flag.load(Ordering::SeqCst)
          && READY_FLAG.iter().any(|p| line.to_lowercase().contains(p))
        {
          self.game_ready_flag.store(true, Ordering::SeqCst);
          // record Instant::now as game start time
          let mut start_time_lock = self.start_time.lock().unwrap();
          if start_time_lock.is_none() {
            *start_time_lock = Some(Instant::now());
          }
          let _ = self.ready_tx.send(());
        }
      }
    })
  }
}

pub async fn record_play_time(app: AppHandle, start_time: Instant, instance_id: String) {
  let binding = app.state::<Mutex<HashMap<String, Instance>>>();
  let inst = binding.lock().unwrap().get(&instance_id).cloned();
  if let Some(mut instance) = inst {
    instance.play_time = start_time.elapsed().as_secs() as u128;
    let _ = instance.clone().save_json_cfg().await;
  }
}

pub async fn monitor_process(
  app: AppHandle,
  mut child: Child,
  instance_id: String,
  display_log_window: bool,
  launcher_visibility: LauncherVisiablity,
  ready_tx: Sender<()>,
) -> SJMCLResult<()> {
  // create unique log window
  let timestamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap()
    .as_secs();
  let label = format!("game_log_{timestamp}");
  let log_file_dir = app
    .path()
    .resolve::<PathBuf>(format!("{label}.log").into(), BaseDirectory::AppCache)?;

  let log_file = Arc::new(Mutex::new(
    std::fs::OpenOptions::new()
      .create_new(true)
      .write(true)
      .read(true)
      .open(&log_file_dir)?,
  ));

  let log_window = if display_log_window {
    create_webview_window(&app, &label, "game_log", None)
      .await
      .ok()
  } else {
    None
  };

  let game_ready_flag = Arc::new(AtomicBool::new(false));
  let start_time: Arc<Mutex<Option<Instant>>> = Arc::new(Mutex::new(None)); // used to calculate play time

  let stdout = child.stdout.take().map(|out| {
    (OutputPipe {
      app: app.clone(),
      label: label.clone(),
      out,
      start_time: start_time.clone(),
      log_file: log_file.clone(),
      display_log_window,
      ready_tx: ready_tx.clone(),
      game_ready_flag: game_ready_flag.clone(),
    })
    .listen_from_output()
  });

  // handle game process stderr
  let stderr = child.stderr.take().map(|out| {
    (OutputPipe {
      app: app.clone(),
      label: label.clone(),
      out,
      start_time: start_time.clone(),
      log_file: log_file.clone(),
      display_log_window,
      ready_tx: ready_tx.clone(),
      game_ready_flag: game_ready_flag.clone(),
    })
    .listen_from_output()
  });

  // handle game process exit
  let instance_id_clone = instance_id.clone();
  let game_ready_flag = game_ready_flag.clone();

  tokio::spawn(async move {
    let exit_ok = match child.wait() {
      Ok(status) => {
        if let Some(h) = stdout {
          let _ = h.join();
        }

        if let Some(h) = stderr {
          let _ = h.join();
        }

        if !game_ready_flag.load(Ordering::SeqCst) {
          false
        } else {
          log_file.lock().unwrap().flush().unwrap();
          status.success()
        }
      }

      Err(e) => {
        writeln!(
          log_file.lock().unwrap(),
          "[FATAL] Game process was killed Reason: {e}."
        )
        .unwrap();
        false
      }
    };

    drop(log_file);
    // handle launcher main window visiablity
    match launcher_visibility {
      LauncherVisiablity::RunningHidden => {
        let main_window = app.get_webview_window("main").expect("no main window");
        let _ = main_window.show();
        let _ = main_window.set_focus();
      }
      LauncherVisiablity::StartHidden => {
        // If the main window is still hidden (not shown again due to the single instance plugin when the user runs the launcher again), exit the launcher process
        let main_window = app.get_webview_window("main").expect("no main window");
        if let Ok(is_visible) = main_window.is_visible() {
          if !is_visible {
            std::process::exit(0);
          }
        } else {
          std::process::exit(0);
        }
      }
      _ => {}
    }

    if exit_ok {
      if let Some(ref window) = log_window {
        let _ = window.destroy();
      }

      let start_time_lock = *start_time.lock().unwrap();

      if let Some(start_time) = start_time_lock {
        record_play_time(app.clone(), start_time, instance_id_clone).await;
      }
    } else {
      let _ = create_webview_window(&app, &label.replace("log", "error"), "game_error", None)
        .await
        .unwrap();
    }
  });

  Ok(())
}

pub fn kill_process(pid: u32) -> SJMCLResult<()> {
  // KNOWN ISSUE: kill process means exit abnormally, which will not close the game-log window automatically.
  #[cfg(any(target_os = "linux", target_os = "macos"))]
  {
    Command::new("kill")
      .args(["-9", &pid.to_string()])
      .output()
      .map_err(|_| LaunchError::KillProcessFailed)?;
  }

  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;

    Command::new("taskkill")
      .args(["/F", "/T", "/PID", &pid.to_string()])
      .creation_flags(0x08000000) // CREATE_NO_WINDOW
      .output()
      .map_err(|_| LaunchError::KillProcessFailed)?;
  }

  Ok(())
}

pub fn set_process_priority(pid: u32, priority: &ProcessPriority) -> SJMCLResult<()> {
  #[cfg(any(target_os = "macos", target_os = "linux"))]
  {
    let nice_value = match *priority {
      ProcessPriority::Low => 5,
      ProcessPriority::BelowNormal => 1,
      ProcessPriority::Normal => 0,
      // FIXME: above normal need permission
      ProcessPriority::AboveNormal => -1,
      ProcessPriority::High => -5,
    };

    let _ = Command::new("renice")
      .args([nice_value.to_string(), "-p".to_string(), pid.to_string()])
      .output()
      .map_err(|_| LaunchError::SetProcessPriorityFailed)?;
  }

  #[cfg(target_os = "windows")]
  {
    use winapi::shared::minwindef::{DWORD, FALSE};
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::processthreadsapi::{OpenProcess, SetPriorityClass};
    use winapi::um::winbase::{
      ABOVE_NORMAL_PRIORITY_CLASS, BELOW_NORMAL_PRIORITY_CLASS, HIGH_PRIORITY_CLASS,
      IDLE_PRIORITY_CLASS, NORMAL_PRIORITY_CLASS,
    };
    use winapi::um::winnt::PROCESS_SET_INFORMATION;

    unsafe {
      let h_process = OpenProcess(PROCESS_SET_INFORMATION, FALSE, pid as DWORD);
      if h_process.is_null() {
        return Err(LaunchError::SetProcessPriorityFailed.into());
      }

      let priority_class = match *priority {
        ProcessPriority::Low => IDLE_PRIORITY_CLASS,
        ProcessPriority::BelowNormal => BELOW_NORMAL_PRIORITY_CLASS,
        ProcessPriority::Normal => NORMAL_PRIORITY_CLASS,
        ProcessPriority::AboveNormal => ABOVE_NORMAL_PRIORITY_CLASS,
        ProcessPriority::High => HIGH_PRIORITY_CLASS,
      };

      if SetPriorityClass(h_process, priority_class) == 0 {
        CloseHandle(h_process);
        return Err(LaunchError::SetProcessPriorityFailed.into());
      }

      CloseHandle(h_process);
    }
  }

  Ok(())
}

pub fn change_process_window_title(pid: u32, new_title: &str) -> SJMCLResult<()> {
  #[cfg(target_os = "windows")]
  {
    use std::ffi::OsStr;
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    use winapi::shared::minwindef::{BOOL, DWORD, LPARAM, TRUE};
    use winapi::shared::windef::HWND;
    use winapi::um::winnt::LPCWSTR;
    use winapi::um::winuser::{EnumWindows, GetWindowThreadProcessId, SetWindowTextW};
    let new_title = new_title.to_string();
    thread::spawn(move || {
      // sleep for a while to wait for the game window to be created.
      // TODO: find a better way.
      thread::sleep(std::time::Duration::from_secs(5));
      let closure = |hwnd: HWND| unsafe {
        let mut window_pid: DWORD = 0;
        GetWindowThreadProcessId(hwnd, &mut window_pid);
        if window_pid == pid {
          let new_title: Vec<u16> = OsStr::new(&new_title)
            .encode_wide()
            .chain(once(0))
            .collect();
          SetWindowTextW(hwnd, new_title.as_ptr() as LPCWSTR);
        }
      };
      type ForEachCallback<'a> = Box<dyn FnMut(HWND) + 'a>;
      let wrapper: ForEachCallback = Box::new(closure);
      unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        if let Some(boxed) = (lparam as *mut ForEachCallback).as_mut() {
          (*boxed)(hwnd);
        }
        TRUE
      }
      unsafe {
        EnumWindows(Some(enum_proc), &wrapper as *const _ as LPARAM);
      }
    });
  }

  #[cfg(any(target_os = "macos", target_os = "linux"))]
  {
    // not support yet.
    let _ = (pid, new_title, LaunchError::ChangeWindowTitleFailed); // avoid unused warning
  }

  Ok(())
}
