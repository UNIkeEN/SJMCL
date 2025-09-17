use crate::{
  error::SJMCLResult,
  launcher_config::{
    helpers::java::refresh_and_update_javas,
    models::{JavaInfo, LauncherConfig},
  },
  resource::helpers::misc::{get_download_api, get_source_priority_list},
  resource::models::{ResourceType, SourceType},
  tasks::{
    commands::schedule_progressive_task_group, download::DownloadParam, events::GEventStatus,
    monitor::TaskMonitor, PTaskParam,
  },
  utils::fs::extract_filename,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use url::Url;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JavaRuntimeInfo {
  #[serde(flatten)]
  pub platforms: HashMap<String, HashMap<String, Vec<JavaRuntimeRelease>>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JavaRuntimeRelease {
  pub availability: JavaRuntimeAvailability,
  pub manifest: JavaRuntimeManifest,
  pub version: JavaRuntimeVersion,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JavaRuntimeAvailability {
  pub group: i32,
  pub progress: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JavaRuntimeVersion {
  pub name: String,
  pub released: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JavaRuntimeManifest {
  pub sha1: String,
  pub size: i64,
  pub url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JavaRuntimeManifestContent {
  pub files: HashMap<String, JavaRuntimeFile>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JavaRuntimeFile {
  #[serde(rename = "type")]
  pub file_type: String,
  pub downloads: Option<JavaRuntimeFileDownloads>,
  pub executable: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JavaRuntimeFileDownloads {
  pub raw: Option<JavaRuntimeFileDownload>,
  pub lzma: Option<JavaRuntimeFileDownload>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JavaRuntimeFileDownload {
  pub sha1: String,
  pub size: i64,
  pub url: String,
}

/// 获取系统对应的平台标识符
fn get_platform_identifier() -> &'static str {
  #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
  {
    "windows-x64"
  }
  #[cfg(all(target_os = "windows", target_arch = "x86"))]
  {
    "windows-x86"
  }
  #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
  {
    "mac-os"
  }
  #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
  {
    "mac-os-arm64"
  }
  #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
  {
    "linux"
  }
  #[cfg(not(any(
    all(target_os = "windows", target_arch = "x86_64"),
    all(target_os = "windows", target_arch = "x86"),
    all(target_os = "macos", target_arch = "x86_64"),
    all(target_os = "macos", target_arch = "aarch64"),
    all(target_os = "linux", target_arch = "x86_64")
  )))]
  {
    // 默认返回 Linux x64，虽然可能不完全正确，但是作为fallback
    "linux"
  }
}

/// 根据Java主版本号获取Mojang运行时标识符
fn get_java_runtime_name(major_version: i32) -> &'static str {
  match major_version {
    8 => "jre-legacy",
    17 => "java-runtime-gamma",
    21 => "java-runtime-delta",
    _ => {
      // 对于其他版本，尝试使用最新的运行时
      if major_version >= 21 {
        "java-runtime-delta"
      } else if major_version >= 17 {
        "java-runtime-gamma"
      } else {
        "jre-legacy"
      }
    }
  }
}

/// 获取Java运行时信息
async fn get_java_runtime_info(
  app: &AppHandle,
  priority_list: &[SourceType],
) -> SJMCLResult<JavaRuntimeInfo> {
  let client = app.state::<reqwest::Client>();

  for source in priority_list.iter() {
    let url = get_download_api(*source, ResourceType::MojangJava)?;

    if let Ok(response) = client.get(url).send().await {
      if response.status().is_success() {
        if let Ok(runtime_info) = response.json::<JavaRuntimeInfo>().await {
          return Ok(runtime_info);
        }
      }
    }
  }

  Err(crate::error::SJMCLError(
    "Failed to fetch Java runtime info".to_string(),
  ))
}

/// 获取Java运行时清单
async fn get_java_runtime_manifest(
  app: &AppHandle,
  manifest_url: &str,
) -> SJMCLResult<JavaRuntimeManifestContent> {
  let client = app.state::<reqwest::Client>();

  let response = client
    .get(manifest_url)
    .send()
    .await
    .map_err(|_| crate::error::SJMCLError("Failed to fetch Java runtime manifest".to_string()))?;

  if response.status().is_success() {
    let manifest = response
      .json::<JavaRuntimeManifestContent>()
      .await
      .map_err(|_| crate::error::SJMCLError("Failed to parse Java runtime manifest".to_string()))?;
    Ok(manifest)
  } else {
    Err(crate::error::SJMCLError(
      "Failed to fetch Java runtime manifest".to_string(),
    ))
  }
}

/// 获取Java安装目录
fn get_java_install_dir(app: &AppHandle, major_version: i32) -> SJMCLResult<PathBuf> {
  let app_data_dir = app.path().app_data_dir()?;
  let java_dir = app_data_dir
    .join("java")
    .join(format!("java-{}", major_version));
  Ok(java_dir)
}

/// 自动下载指定版本的Java运行时
pub async fn auto_download_java(
  app: &AppHandle,
  required_major_version: i32,
) -> SJMCLResult<JavaInfo> {
  let config_state = app.state::<Mutex<LauncherConfig>>();
  let launcher_config = config_state.lock()?.clone();
  let priority_list = get_source_priority_list(&launcher_config);

  // 获取Java运行时信息
  let runtime_info = get_java_runtime_info(app, &priority_list).await?;

  let platform = get_platform_identifier();
  let runtime_name = get_java_runtime_name(required_major_version);

  // 查找适合的运行时版本
  let platform_runtimes = runtime_info
    .platforms
    .get(platform)
    .ok_or_else(|| crate::error::SJMCLError(format!("Platform '{}' not supported", platform)))?;

  let runtime_releases = platform_runtimes.get(runtime_name).ok_or_else(|| {
    crate::error::SJMCLError(format!(
      "Java runtime '{}' not found for platform '{}'",
      runtime_name, platform
    ))
  })?;

  let release = runtime_releases.first().ok_or_else(|| {
    crate::error::SJMCLError(format!(
      "No releases available for Java runtime '{}'",
      runtime_name
    ))
  })?;

  // 获取运行时清单
  let manifest_content = get_java_runtime_manifest(app, &release.manifest.url).await?;

  // 确定安装目录
  let install_dir = get_java_install_dir(app, required_major_version)?;

  // 创建下载任务
  let mut download_params = Vec::new();

  for (file_path, file_info) in manifest_content.files {
    if file_info.file_type == "file" {
      if let Some(downloads) = file_info.downloads {
        let download_info = downloads.raw.or(downloads.lzma);
        if let Some(download) = download_info {
          let dest_path = install_dir.join(&file_path);

          download_params.push(PTaskParam::Download(DownloadParam {
            src: Url::parse(&download.url)
              .map_err(|_| crate::error::SJMCLError("Invalid download URL".to_string()))?,
            dest: dest_path,
            filename: Some(extract_filename(&file_path, false)),
            sha1: Some(download.sha1),
          }));
        }
      }
    }
  }

  // 安排下载任务
  let task_group_name = format!("download-java-{}", required_major_version);
  let _task_group_desc =
    schedule_progressive_task_group(app.clone(), task_group_name.clone(), download_params, true)
      .await?;

  // 等待下载任务组完成

  // 监听任务状态
  let task_monitor = app.state::<std::pin::Pin<Box<TaskMonitor>>>();
  let mut retry_count = 0;
  let max_retries = 120; // 最多等待10分钟 (120 * 5秒)

  loop {
    let task_groups = task_monitor.state_list();
    let our_group = task_groups.iter().find(|g| g.task_group == task_group_name);

    match our_group {
      Some(group) => {
        match group.status {
          GEventStatus::Completed => {
            break;
          }
          GEventStatus::Failed => {
            return Err(crate::error::SJMCLError("Java运行时下载失败".to_string()));
          }
          GEventStatus::Stopped => {
            return Err(crate::error::SJMCLError("Java运行时下载被停止".to_string()));
          }
          _ => {
            // 仍在进行中
            if retry_count >= max_retries {
              return Err(crate::error::SJMCLError("Java运行时下载超时".to_string()));
            }
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            retry_count += 1;
          }
        }
      }
      None => {
        // 任务组不存在，可能已经完成并被清理
        break;
      }
    }
  }

  // 检查Java可执行文件是否存在 - 增加重试机制确保文件完全就绪
  #[cfg(target_os = "windows")]
  let java_executable = install_dir.join("bin").join("java.exe");
  #[cfg(not(target_os = "windows"))]
  let java_executable = install_dir.join("bin").join("java");

  // 等待文件完全就绪，最多重试30次（150秒）
  let mut retry_count = 0;
  let max_retries = 30;

  loop {
    if java_executable.exists() {
      // 验证文件不是空的或正在写入
      if let Ok(metadata) = std::fs::metadata(&java_executable) {
        if metadata.len() > 0 {
          // 尝试执行Java -version来验证文件完整性
          let test_command = std::process::Command::new(&java_executable)
            .arg("-version")
            .output();

          match test_command {
            Ok(output) => {
              if output.status.success() {
                break;
              }
            }
            Err(_) => {
              // 继续等待
            }
          }
        }
      }
    }

    if retry_count >= max_retries {
      return Err(crate::error::SJMCLError(format!(
        "Java运行时下载超时或不完整，文件: {:?}",
        java_executable
      )));
    }

    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    retry_count += 1;
  }

  // 设置Java可执行文件权限（Linux/macOS）
  #[cfg(any(target_os = "linux", target_os = "macos"))]
  {
    if java_executable.exists() {
      use std::os::unix::fs::PermissionsExt;
      let mut perms = std::fs::metadata(&java_executable)?.permissions();
      perms.set_mode(0o755);
      std::fs::set_permissions(&java_executable, perms)?;
    }
  }

  let exec_path = java_executable
    .to_str()
    .ok_or_else(|| crate::error::SJMCLError("Invalid Java executable path".to_string()))?
    .to_string();

  // 创建JavaInfo对象
  let java_info = JavaInfo {
    name: format!("Mojang JRE {}", required_major_version),
    major_version: required_major_version,
    is_lts: [8, 11, 17, 21].contains(&required_major_version),
    exec_path: exec_path.clone(),
    vendor: "Mojang".to_string(),
    is_user_added: false,
  };

  // 刷新Java列表，确保新下载的Java被识别
  refresh_and_update_javas(app).await;

  // 再次强制刷新确保路径被正确添加
  tokio::time::sleep(std::time::Duration::from_secs(2)).await;
  refresh_and_update_javas(app).await;

  // 将新下载的Java路径添加到配置中
  {
    let config_state = app.state::<Mutex<LauncherConfig>>();
    let mut config = config_state.lock()?;
    if !config.extra_java_paths.contains(&exec_path) {
      config.extra_java_paths.push(exec_path.clone());
    }
  }

  Ok(java_info)
}

/// 检查是否已经下载了指定版本的Java
pub fn check_downloaded_java(app: &AppHandle, major_version: i32) -> Option<JavaInfo> {
  if let Ok(install_dir) = get_java_install_dir(app, major_version) {
    #[cfg(target_os = "windows")]
    let java_executable = install_dir.join("bin").join("java.exe");
    #[cfg(not(target_os = "windows"))]
    let java_executable = install_dir.join("bin").join("java");

    if java_executable.exists() {
      let exec_path = java_executable.to_str()?.to_string();

      return Some(JavaInfo {
        name: format!("Mojang JRE {}", major_version),
        major_version,
        is_lts: [8, 11, 17, 21].contains(&major_version),
        exec_path,
        vendor: "Mojang".to_string(),
        is_user_added: false,
      });
    }
  }
  None
}
