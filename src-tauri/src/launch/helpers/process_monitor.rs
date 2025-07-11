use crate::error::SJMCLResult;
use crate::instance::models::misc::Instance;
use crate::launch::constant::*;
use crate::launch::models::LaunchError;
use crate::launcher_config::models::{LauncherVisiablity, ProcessPriority};
use crate::utils::window::create_webview_window;
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command};
use std::sync::{atomic, mpsc::Sender, Arc, Mutex};
use std::thread;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tokio;

pub async fn monitor_process(
  app: AppHandle,
  child: &mut Child,
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
  let label = format!("game_log_{}", timestamp);
  let log_window = if display_log_window {
    match create_webview_window(&app, &label, "game_log", None).await {
      Ok(window) => Some(window),
      Err(_) => None,
    }
  } else {
    None
  };

  let stdout = child.stdout.take();
  let stderr = child.stderr.take();
  let game_ready_flag = Arc::new(atomic::AtomicBool::new(false));
  let start_time: Arc<Mutex<Option<Instant>>> = Arc::new(Mutex::new(None)); // used to calculate play time

  // handle game process stdout
  if let Some(out) = stdout {
    let app_stdout = app.clone();
    let label_stdout = label.clone();
    let tx_clone_stdout = ready_tx.clone();
    let game_ready_flag = game_ready_flag.clone();
    let start_time = start_time.clone();

    thread::spawn(move || {
      let reader = BufReader::new(out);
      for line in reader.lines().map_while(Result::ok) {
        if display_log_window {
          let _ = app_stdout.emit_to(&label_stdout, GAME_PROCESS_OUTPUT_CHANNEL, &line);
        }

        // the first time when log contains 'render thread', 'lwjgl version', or 'lwjgl openal', send signal to launch command, close frontend modal.
        if !game_ready_flag.load(atomic::Ordering::SeqCst)
          && READY_FLAG.iter().any(|p| line.to_lowercase().contains(p))
        {
          game_ready_flag.store(true, atomic::Ordering::SeqCst);

          // record Instant::now as game start time
          let mut start_time_lock = start_time.lock().unwrap();
          if start_time_lock.is_none() {
            *start_time_lock = Some(Instant::now());
          }

          let _ = tx_clone_stdout.send(());
        }
      }
    });
  }

  // handle game process stderr
  if let Some(err) = stderr {
    let app_stderr = app.clone();
    let label_stderr = label.clone();
    let tx_clone_stderr = ready_tx.clone();
    let game_ready_flag = game_ready_flag.clone();
    let start_time = start_time.clone();

    thread::spawn(move || {
      let reader = BufReader::new(err);
      for line in reader.lines().map_while(Result::ok) {
        if display_log_window {
          let _ = app_stderr.emit_to(&label_stderr, GAME_PROCESS_OUTPUT_CHANNEL, &line);
        }

        if !game_ready_flag.load(atomic::Ordering::SeqCst)
          && READY_FLAG.iter().any(|p| line.to_lowercase().contains(p))
        {
          game_ready_flag.store(true, atomic::Ordering::SeqCst);

          let mut start_time_lock = start_time.lock().unwrap();
          if start_time_lock.is_none() {
            *start_time_lock = Some(Instant::now());
          }

          let _ = tx_clone_stderr.send(());
        }
      }
    });
  }

  // handle game process exit
  let instance_id_clone = instance_id.clone();
  let mut dummy_child;
  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    dummy_child = Command::new("cmd")
      .args(&["/C", "exit", "0"])
      .creation_flags(0x08000000)
      .spawn()?;
  }
  #[cfg(any(target_os = "linux", target_os = "macos"))]
  {
    dummy_child = Command::new("true").spawn()?;
  }
  let _ = dummy_child.wait();
  let mut child = std::mem::replace(child, dummy_child);
  let game_ready_flag = game_ready_flag.clone();
  tokio::spawn(async move {
    if let Ok(status) = child.wait() {
      if !game_ready_flag.load(atomic::Ordering::SeqCst) {
        let _ = ready_tx.send(());
      }

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

      if status.success() {
        println!("Game process exited successfully.");
        if let Some(ref window) = log_window {
          // auto close the game-log window if the game exits successfully
          let _ = window.destroy();
        }
      } else {
        println!("Game process exited with an error status: {:?}", status);
        let _ =
          create_webview_window(&app, &label.replace("log", "error"), "game_error", None).await;
      }

      // calc and update play time
      let start_time_lock = start_time.lock().unwrap();
      if let Some(start_time) = *start_time_lock {
        let elapsed_time = start_time.elapsed().as_secs() as u128;

        let binding = app.state::<Mutex<HashMap<String, Instance>>>();
        let mut state = binding.lock().unwrap();
        if let Some(instance) = state.get_mut(&instance_id_clone) {
          instance.play_time += elapsed_time;
          let instance_clone = instance.clone();
          tokio::task::spawn(async move {
            let _ = &instance_clone.save_json_cfg().await;
          });
        }
      }
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

// fn is_process_exists(pid: u32) -> bool {
//   #[cfg(target_os = "windows")]
//   {
//     use std::os::windows::process::CommandExt;

//     let output = Command::new("tasklist")
//       .arg("/FI")
//       .arg(format!("PID eq {}", pid))
//       .output()
//       .unwrap();
//     output.stdout.contains(&pid.to_string().into_bytes())
//   }

//   #[cfg(any(target_os = "linux", target_os = "macos"))]
//   {
//     let output = Command::new("ps")
//       .arg("-p")
//       .arg(pid.to_string())
//       .output()
//       .unwrap();
//     output.status.success()
//   }
// }
