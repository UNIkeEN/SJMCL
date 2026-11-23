use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

use crate::launcher_config::models::JavaInfo;

const DISABLE_BASE64_INTRINSICS: &str = "-XX:-UseBASE64Intrinsics";

// CVE-2026-114938: https://github.com/HMCL-dev/HMCL/pull/7318
fn is_affected_version(version: &str) -> bool {
  let version = version.split('+').next().unwrap_or_default();
  let (number, prerelease) = version.split_once('-').unwrap_or((version, ""));
  let mut components = [0; 4];
  for (index, part) in number.split('.').enumerate() {
    let Ok(value) = part.parse::<u32>() else {
      return false;
    };
    // The fixed versions use four components. Vendor build numbers may follow them.
    if let Some(component) = components.get_mut(index) {
      *component = value;
    }
  }

  let [major, interim, update, patch] = components;
  let version = (interim, update, patch);
  let fixed = match major {
    17 if version >= (0, 6, 0) => (0, 21, 1),
    21 => (0, 13, 1),
    25 => (0, 5, 1),
    27 => (0, 1, 1),
    18..=20 | 22..=24 | 26 => return true,
    _ => return false,
  };

  version < fixed || (version == fixed && !prerelease.is_empty())
}

fn is_java8_perf_candidate(version: &str) -> bool {
  // Oracle's affected 8u511 Enterprise Performance Pack exposes its flavor in java.runtime.version.
  // https://www.oracle.com/java/technologies/javase/8all-relnotes.html
  cfg!(target_os = "linux") && version.split('-').next() == Some("1.8.0_511")
}

fn has_confirmed_mitigation(stdout: &str, stderr: &str) -> bool {
  let property = |name| {
    stderr.lines().chain(stdout.lines()).find_map(|line| {
      let (key, value) = line.split_once('=')?;
      (key.trim() == name).then(|| value.trim())
    })
  };

  matches!(property("os.arch"), Some("amd64" | "x86_64"))
    && (property("java.version").is_some_and(is_affected_version)
      || property("java.runtime.version").is_some_and(|version| {
        version == "1.8.0_511-perf" || version.starts_with("1.8.0_511-perf-")
      }))
    && stdout.lines().chain(stderr.lines()).any(|line| {
      let mut fields = line.split_ascii_whitespace();
      matches!(
        (fields.next(), fields.next(), fields.next(), fields.next()),
        (
          Some("bool"),
          Some("UseBASE64Intrinsics"),
          Some("=" | ":="),
          Some("false")
        )
      )
    })
}

pub(super) async fn base64_mitigation_arg(java: &JavaInfo) -> Option<&'static str> {
  if !is_affected_version(&java.full_version) && !is_java8_perf_candidate(&java.full_version) {
    return None;
  }

  let mut command = Command::new(&java.exec_path);
  #[cfg(target_os = "windows")]
  command.creation_flags(0x08000000); // CREATE_NO_WINDOW

  // A version-only probe confirms the selected JVM implements and accepts the flag.
  // Keep inherited JVM options out of this probe so they cannot change its result.
  command
    .args([
      DISABLE_BASE64_INTRINSICS,
      "-XX:+PrintFlagsFinal",
      "-XshowSettings:properties",
      "-version",
    ])
    .env_remove("JAVA_TOOL_OPTIONS")
    .env_remove("JDK_JAVA_OPTIONS")
    .env_remove("_JAVA_OPTIONS")
    .kill_on_drop(true);

  let output = timeout(Duration::from_secs(5), command.output())
    .await
    .ok()?
    .ok()?;
  (output.status.success()
    && has_confirmed_mitigation(
      &String::from_utf8_lossy(&output.stdout),
      &String::from_utf8_lossy(&output.stderr),
    ))
  .then_some(DISABLE_BASE64_INTRINSICS)
}

#[cfg(test)]
mod tests {
  use crate::launch::helpers::java_base64_mitigation::{
    has_confirmed_mitigation, is_affected_version,
  };

  #[test]
  fn base64_mitigation_respects_java_version_boundaries() {
    for (version, expected) in [
      ("1.8.0_511", false),
      ("11.0.33", false),
      ("17.0.5", false),
      ("17.0.6", true),
      ("17.0.21.0.3", true),
      ("17.0.21.1+2", false),
      ("17.0.21.1-ea+1", true),
      ("18", true),
      ("20.0.2", true),
      ("21.0.9", true),
      ("21.0.13", true),
      ("21.0.13.1+2-LTS", false),
      ("22.0.2", true),
      ("24.0.2", true),
      ("25.0.5", true),
      ("25.0.5.1.2", false),
      ("26-ea", true),
      ("27.0.1", true),
      ("27.0.1.1", false),
      ("28-ea", false),
      ("21.0..1", false),
    ] {
      assert_eq!(is_affected_version(version), expected, "{version}");
    }
  }

  #[test]
  fn base64_mitigation_requires_a_matching_jvm_and_disabled_flag() {
    let flag = "bool UseBASE64Intrinsics = false {product} {command line}";
    let x64 = "    os.arch = amd64\n    java.version = 21.0.13";
    assert!(has_confirmed_mitigation(flag, x64));
    assert!(!has_confirmed_mitigation("", x64));
    assert!(!has_confirmed_mitigation(
      "bool UseBASE64Intrinsics = true {product}",
      x64
    ));
    assert!(!has_confirmed_mitigation(
      flag,
      "os.arch = aarch64\njava.version = 21.0.13"
    ));
    assert!(!has_confirmed_mitigation(
      flag,
      "os.arch = amd64\njava.version = 21.0.13.1"
    ));
    assert!(has_confirmed_mitigation(
      flag,
      "os.arch = x86_64\njava.version = 1.8.0_511\njava.runtime.version = 1.8.0_511-perf-b33"
    ));
    assert!(!has_confirmed_mitigation(
      flag,
      "os.arch = x86_64\njava.version = 1.8.0_511\njava.runtime.version = 1.8.0_511-b33"
    ));
  }
}
