use crate::error::SJMCLResult;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn check_terracotta_support() -> SJMCLResult<bool> {
  // 检查平台支持
  // #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
  // return Ok(false);

  // 检查陶瓦服务状态
  //// 检查陶瓦服务是否存在
  //// 检查版本是否为最新
  //// 返回状态
  // 实现检查逻辑
  Ok(true)
}

#[tauri::command]
pub async fn download_terracotta(app: AppHandle) -> SJMCLResult<()> {
  // 下载并安装陶瓦联机核心
  // 使用现有的任务系统
  Ok(())
}

#[tauri::command]
pub async fn join_room(invite_code: String) -> SJMCLResult<()> {
  // 获取陶瓦节点列表
  // 构建查询参数
  // 发送HTTP请求
  Ok(())
}

#[tauri::command]
pub async fn create_room() -> SJMCLResult<String> {
  // 检查运行中的MC进程
  // 获取陶瓦节点列表
  // 创建房间并返回邀请码
  Ok("invite_code".to_string())
}

//TODO: 在 src-tauri/src/lib.rs 中注册新命令
