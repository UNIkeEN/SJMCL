use crate::instance::helpers::client_json::{McClientInfo, reset_fields_from_patches};
use crate::instance::helpers::loader::common::add_library_entry;
use crate::instance::helpers::loader::forge::InstallProfile;
use crate::instance::helpers::misc::get_instance_subdir_paths;
use crate::instance::models::misc::{Instance, InstanceError, InstanceSubdirType, ModLoader};
use crate::launch::helpers::file_validator::convert_library_name_to_path;
use crate::resource::helpers::misc::{convert_url_to_target_source, get_download_api};
use crate::resource::models::{ResourceType, SourceType};
use crate::tasks::PTaskParam;
use crate::tasks::commands::schedule_progressive_task_group;
use crate::tasks::download::DownloadParam;
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::fs;
use std::fs::File;
use std::io::Read;
use std::path::PathBuf;
use tauri::AppHandle;
use url::{ParseError, Url};
use zip::ZipArchive;

pub async fn install_cleanroom_loader(
  priority: &[SourceType],
  loader: &ModLoader,
  lib_dir: PathBuf,
  task_params: &mut Vec<PTaskParam>,
) -> SJMCLResult<()> {
  let mut installer_url_opt: Option<Url> = None;
  for source_type in priority.iter() {
    if let Ok(root) = get_download_api(*source_type, ResourceType::CleanroomInstall) {
      let url_res: Result<Url, ParseError> =
        root.join(&format!("cleanroom-{}-installer.jar", loader.version));

      if let Ok(url) = url_res {
        installer_url_opt = Some(url);
        break;
      }
    }
  }

  let installer_url = installer_url_opt.ok_or(SJMCLError(
    "failed to resolve Cleanroom installer URL".to_string(),
  ))?;

  let installer_coord = format!("com.cleanroommc:cleanroom:{}-installer", loader.version);
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

pub async fn download_cleanroom_libraries(
  app: &AppHandle,
  priority: &[SourceType],
  instance: &Instance,
  client_info: &mut McClientInfo,
) -> SJMCLResult<()> {
  let subdirs = get_instance_subdir_paths(app, instance, &[&InstanceSubdirType::Libraries])
    .ok_or(InstanceError::InvalidSourcePath)?;
  let [lib_dir] = subdirs.as_slice() else {
    return Err(InstanceError::InvalidSourcePath.into());
  };
  let mut task_params = vec![];

  let installer_coord = format!(
    "com.cleanroommc:cleanroom:{}-installer",
    instance.mod_loader.version
  );
  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = lib_dir.join(&installer_rel);
  if !installer_path.exists() {
    return Err(InstanceError::LoaderInstallerNotFound.into());
  }
  let file = File::open(&installer_path)?;
  let mut archive = ZipArchive::new(file)?;

  // Extract maven folder contents to lib_dir
  for i in 0..archive.len() {
    let mut file = archive.by_index(i)?;
    let path = file.mangled_name();
    let Ok(relative_path) = path.strip_prefix("maven/") else {
      continue;
    };
    let outpath = lib_dir.join(relative_path);

    if file.is_file() {
      // Create parent directories if they don't exist
      if let Some(p) = outpath.parent()
        && !p.exists()
      {
        fs::create_dir_all(p)?;
      }

      // Extract file
      let mut outfile = File::create(&outpath)?;
      std::io::copy(&mut file, &mut outfile)?;
    }
  }

  let (install_profile, version) = {
    let mut s = String::new();
    if let Ok(mut install_profile) = archive.by_name("install_profile.json") {
      install_profile.read_to_string(&mut s)?;
    }

    let mut t = String::new();
    if let Ok(mut version_file) = archive.by_name("version.json") {
      version_file.read_to_string(&mut t)?;
    }

    (s, t)
  };

  if install_profile.is_empty() {
    return Err(InstanceError::InstallProfileParseError.into());
  }

  let profile: InstallProfile =
    serde_json::from_str(&install_profile).map_err(|_| InstanceError::InstallProfileParseError)?;

  let cleanroom_info: McClientInfo = serde_json::from_str(&version)?;
  client_info.main_class = cleanroom_info.main_class.clone();

  let mut loader_libraries = vec![];
  for lib in cleanroom_info.libraries.iter() {
    let name = &lib.name;
    add_library_entry(&mut client_info.libraries, name, Some(lib.clone()))?;
    add_library_entry(&mut loader_libraries, name, Some(lib.clone()))?;

    let url = lib
      .downloads
      .as_ref()
      .and_then(|d| d.artifact.as_ref())
      .map(|a| a.url.as_str())
      .unwrap_or_default();
    if url.is_empty() {
      continue;
    }

    task_params.push(PTaskParam::Download(DownloadParam {
      src: convert_url_to_target_source(
        &Url::parse(url)?,
        &[
          ResourceType::ForgeMaven,
          ResourceType::ForgeMavenNew,
          ResourceType::Libraries,
        ],
        &priority[0],
      )?,
      dest: lib_dir.join(&convert_library_name_to_path(name, None)?),
      filename: None,
      sha1: None,
    }));
  }

  let arguments = cleanroom_info.arguments.clone();
  let minecraft_arguments = if arguments.is_some() {
    None
  } else {
    cleanroom_info.minecraft_arguments.clone()
  };

  client_info.patches.push(McClientInfo {
    id: "cleanroom".to_string(),
    version: Some(instance.mod_loader.version.clone()),
    priority: Some(30000),
    inherits_from: cleanroom_info.inherits_from.clone(),
    main_class: cleanroom_info.main_class.clone(),
    arguments,
    minecraft_arguments,
    libraries: loader_libraries,
    ..Default::default()
  });

  for lib in profile.libraries.iter() {
    let name = &lib.name;
    let url = lib
      .downloads
      .as_ref()
      .and_then(|d| d.artifact.as_ref())
      .map(|a| a.url.as_str())
      .unwrap_or_default();

    if url.is_empty() {
      continue;
    }

    let rel = convert_library_name_to_path(&name.to_string(), None)?;
    task_params.push(PTaskParam::Download(DownloadParam {
      src: convert_url_to_target_source(
        &Url::parse(url)?,
        &[ResourceType::CleanroomMaven, ResourceType::Libraries],
        &priority[0],
      )?,
      dest: lib_dir.join(&rel),
      filename: None,
      sha1: None,
    }));
  }

  reset_fields_from_patches(client_info);

  let mut seen = std::collections::HashSet::new();
  task_params.retain(|param| match param {
    PTaskParam::Download(dp) => seen.insert(dp.dest.clone()),
  });

  schedule_progressive_task_group(
    app.clone(),
    format!("cleanroom-libraries?{}", instance.id),
    task_params,
    true,
  )
  .await?;

  Ok(())
}
