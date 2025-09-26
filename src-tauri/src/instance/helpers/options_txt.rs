use super::game_version::compare_game_versions;
use tauri::AppHandle;

pub async fn get_zh_hans_lang_tag(game_version: &str, app: &AppHandle) -> Option<&'static str> {
  // ref: https://github.com/HMCL-dev/HMCL/blob/6a497df0d1cd873698100707a25f7272d344416e/HMCL/src/main/java/org/jackhuang/hmcl/game/HMCLGameLauncher.java#L87
  if compare_game_versions(app, game_version, "1.1", false)
    .await
    .is_lt()
  {
    Some("zh_CN")
  } else if compare_game_versions(app, game_version, "1.11", false)
    .await
    .is_ge()
  {
    Some("zh_cn")
  } else {
    None
  }
}

// TBD: struct of options.txt and more helpers?
