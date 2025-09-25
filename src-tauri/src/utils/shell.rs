use crate::error::{SJMCLError, SJMCLResult};
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

pub fn split_command_line(wrapper: &str) -> SJMCLResult<Option<Command>> {
  if wrapper.trim().is_empty() {
    return Ok(None);
  }

  let parts = match shlex::split(wrapper) {
    Some(p) if !p.is_empty() => p,
    _ => {
      return Err(SJMCLError("Invalid command line".to_string()));
    }
  };

  let mut cmd = Command::new(&parts[0]);
  if parts.len() > 1 {
    cmd.args(&parts[1..]);
  }

  Ok(Some(cmd))
}
