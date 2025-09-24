use std::io;
use std::process::{Command, ExitStatus};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub fn execute_command_line(cmdline: &str) -> io::Result<ExitStatus> {
  #[cfg(target_os = "windows")]
  {
    let mut cmd = Command::new("cmd");
    cmd.arg("/C").arg(cmdline);
    cmd.creation_flags(0x08000000);
    cmd.status()
  }

  #[cfg(not(target_os = "windows"))]
  {
    let mut cmd = Command::new("/bin/sh");
    cmd.arg("-c").arg(cmdline);
    cmd.status()
  }
}

pub fn split_wrapper(wrapper: &str) -> Option<(std::ffi::OsString, Vec<std::ffi::OsString>)> {
  if wrapper.trim().is_empty() {
    return None;
  }
  if let Some(parts) = shlex::split(wrapper) {
    if parts.is_empty() {
      return None;
    }
    let mut iter = parts.into_iter();
    let prog = std::ffi::OsString::from(iter.next().unwrap());
    let args = iter.map(std::ffi::OsString::from).collect::<Vec<_>>();
    Some((prog, args))
  } else {
    None
  }
}
