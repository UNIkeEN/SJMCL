use std::path::PathBuf;

use crate::error::SJMCLResult;
use crate::launch::helpers::file_validator::convert_library_name_to_path;
use crate::resource::helpers::misc::get_download_api;
use crate::resource::models::{OptiFineResourceInfo, ResourceType, SourceType};
use crate::tasks::download::DownloadParam;
use crate::tasks::PTaskParam;

pub async fn install_optifine(
  priority: &[SourceType],
  game_version: &str,
  optifine: &OptiFineResourceInfo,
  lib_dir: PathBuf,
  task_params: &mut Vec<PTaskParam>,
) -> SJMCLResult<()> {
  let root = get_download_api(priority[0], ResourceType::OptiFine)?;

  let installer_url = match *priority.first().unwrap_or(&SourceType::Official) {
    SourceType::Official => root.join(&format!(
      "{}/{}/{}",
      game_version, optifine.r#type, optifine.patch
    ))?,
    SourceType::BMCLAPIMirror => root.join(&format!(
      "{}/{}/{}",
      game_version, optifine.r#type, optifine.patch
    ))?,
  };

  let installer_coord = format!(
    "net.minecraftforge:optifine:{}-installer",
    optifine.filename
  );
  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = lib_dir.join(&installer_rel);

  task_params.push(PTaskParam::Download(DownloadParam {
    src: installer_url,
    dest: installer_path.clone(),
    filename: None,
    sha1: None,
  }));

  Ok(())
}
