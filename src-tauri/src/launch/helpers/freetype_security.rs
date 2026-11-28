use serde::Deserialize;
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::collections::HashMap;
use std::path::Path;

use crate::download::DownloadTask;
use crate::instance::helpers::client_json::{
  DownloadsArtifact, FeaturesInfo, IsAllowed, LibrariesDownloads, McClientInfo,
};
use crate::launch::helpers::file_validator::{
  convert_library_name_to_path, get_invalid_library_files,
};
use crate::resource::helpers::misc::get_download_api;
use crate::resource::models::{ResourceType, SourceType};

const FREETYPE_COORDINATE: &str = "org.lwjgl:lwjgl-freetype:";
// Official replacement artifacts, also tracked by HMCL #7360 and #7370.
const FREETYPE_SECURITY_PATCHES: &str = include_str!("../../../assets/game/freetype-security.json");

#[derive(Deserialize)]
struct FreeTypePatch {
  version: String,
  artifacts: HashMap<String, (String, i64)>,
}

fn freetype_coordinate_parts(name: &str) -> Option<(&str, &str)> {
  let name = name.strip_suffix("@jar").unwrap_or(name);
  let coordinate = name.strip_prefix(FREETYPE_COORDINATE)?;
  Some(coordinate.split_once(':').unwrap_or((coordinate, "")))
}

pub async fn prepare_freetype_security_libraries(
  client_info: &mut McClientInfo,
  library_path: &Path,
  source: SourceType,
  arch: &str,
) -> SJMCLResult<Vec<DownloadTask>> {
  let patches: HashMap<String, FreeTypePatch> = serde_json::from_str(FREETYPE_SECURITY_PATCHES)?;
  let official = get_download_api(SourceType::Official, ResourceType::Libraries)?;
  let mut security_info = McClientInfo::default();
  // Mojang no longer lists a Windows x86 artifact for this release.
  client_info.libraries.retain(|library| {
    !matches!(
      freetype_coordinate_parts(&library.name),
      Some(("3.4.3" | "3.4.3-mojang-2.15.0", "natives-windows-x86"))
    )
  });

  for library in &mut client_info.libraries {
    let Some((version, classifier)) = freetype_coordinate_parts(&library.name) else {
      continue;
    };
    let Some(patch) = patches
      .get(version)
      .or_else(|| patches.values().find(|patch| patch.version == version))
    else {
      continue;
    };
    if !library.is_allowed(&FeaturesInfo::default(), arch)? {
      continue;
    }
    let (sha1, size) = patch
      .artifacts
      .get(classifier)
      .filter(|_| library.natives.is_none())
      .ok_or_else(|| SJMCLError(format!("No patched FreeType artifact for {}", library.name)))?;
    let mut name = format!("{FREETYPE_COORDINATE}{}", patch.version);
    if !classifier.is_empty() {
      name.push(':');
      name.push_str(classifier);
    }
    let path = convert_library_name_to_path(&name, None)?;
    let url = official.join(&path)?.into();

    // Keep the original rules and classifier, but use only the pinned patched artifact.
    library.name = name;
    library.downloads = Some(LibrariesDownloads {
      artifact: Some(DownloadsArtifact {
        path,
        url,
        sha1: sha1.clone(),
        size: *size,
      }),
      ..Default::default()
    });
    security_info.libraries.push(library.clone());
  }

  get_invalid_library_files(source, library_path, &security_info, arch, true).await
}
