use std::fs::File;
use std::io::Read;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

use super::{
  fabric::install_fabric_loader,
  forge::{install_forge_loader, InstallProfile},
  neoforge::install_neoforge_loader,
};
use crate::instance::helpers::client_json::{LibrariesValue, McClientInfo};
use crate::instance::helpers::misc::get_instance_game_config;
use crate::instance::models::misc::{Instance, InstanceError, ModLoaderStatus};
use crate::launch::helpers::file_validator::{parse_library_name, LibraryParts};
use crate::launch::helpers::jre_selector::select_java_runtime;
use crate::launcher_config::models::JavaInfo;
use crate::{
  error::SJMCLResult,
  instance::models::misc::{ModLoader, ModLoaderType},
  resource::models::SourceType,
  tasks::PTaskParam,
};

pub fn add_library_entry(
  libraries: &mut Vec<LibrariesValue>,
  lib_path: &str,
  params: Option<LibrariesValue>,
) -> SJMCLResult<()> {
  let LibraryParts {
    path,
    pack_name,
    pack_version: _pack_version,
    classifier,
    extension,
  } = parse_library_name(lib_path, None)?;

  if let Some(pos) = libraries.iter().position(|item| {
    if let Ok(parts) = parse_library_name(&item.name, None) {
      parts.path == path
        && parts.pack_name == pack_name
        && parts.classifier == classifier
        && parts.extension == extension
    } else {
      false
    }
  }) {
    libraries[pos] = LibrariesValue {
      name: lib_path.to_string(),
      ..params.unwrap_or_default()
    }
  } else {
    libraries.push(LibrariesValue {
      name: lib_path.to_string(),
      ..params.unwrap_or_default()
    });
  }

  Ok(())
}

pub async fn install_mod_loader(
  app: AppHandle,
  priority: &[SourceType],
  game_version: &str,
  loader: &ModLoader,
  lib_dir: PathBuf,
  client_info: &mut McClientInfo,
  task_params: &mut Vec<PTaskParam>,
) -> SJMCLResult<()> {
  match loader.loader_type {
    ModLoaderType::Fabric => {
      install_fabric_loader(
        app,
        priority,
        game_version,
        loader,
        lib_dir,
        client_info,
        task_params,
      )
      .await
    }
    ModLoaderType::Forge => {
      install_forge_loader(priority, game_version, loader, lib_dir, task_params).await
    }
    ModLoaderType::NeoForge => {
      install_neoforge_loader(priority, loader, lib_dir, task_params).await
    }
    _ => Err(InstanceError::UnsupportedModLoader.into()),
  }
}

pub async fn execute_processors(
  app: &AppHandle,
  instance: &Instance,
  client_info: &McClientInfo,
  install_profile: &InstallProfile,
) -> SJMCLResult<()> {
  let mut instance = instance.clone();
  instance.mod_loader.status = ModLoaderStatus::Installing;
  instance.save_json_cfg().await?;

  let javas_state = app.state::<Mutex<Vec<JavaInfo>>>();
  let javas = javas_state.lock()?.clone();

  let game_config = get_instance_game_config(app, &instance);

  let selected_java = select_java_runtime(
    app,
    &game_config.game_java,
    &javas,
    &instance,
    client_info.java_version.major_version,
  )
  .await?;
  println!("Java: {}", selected_java.exec_path.clone());

  for processor in &install_profile.processors {
    println!("[{}] Processing: {}", instance.name, processor.jar);
    let mut archive = ZipArchive::new(File::open(processor.jar.clone())?)?;
    let mut manifest = archive.by_name("META-INF/MANIFEST.MF")?;
    let mut manifest_content = String::new();
    manifest.read_to_string(&mut manifest_content)?;
    let main_class = manifest_content
      .lines()
      .find_map(|line| {
        if line.starts_with("Main-Class: ") {
          Some(line.trim_start_matches("Main-Class: ").trim())
        } else {
          None
        }
      })
      .ok_or(InstanceError::MainClassNotFound)?;
    let mut cmd_base = Command::new(selected_java.exec_path.clone());
    #[cfg(target_os = "windows")]
    {
      use std::os::windows::process::CommandExt;
      cmd_base.creation_flags(0x08000000);
    }

    let processor_path = instance.version_path.join(&processor.jar);
    let mut classpath_arr = processor.classpath.clone();
    classpath_arr.push(processor_path.to_string_lossy().to_string());

    #[cfg(target_os = "windows")]
    let classpath = classpath_arr.join(";");
    #[cfg(not(target_os = "windows"))]
    let classpath = classpath_arr.join(":");

    let args = &processor.args;

    cmd_base.arg("-cp").arg(&classpath).arg(main_class);

    for arg in args {
      cmd_base.arg(arg);
    }

    println!(
      "[{}] Executing processor: {} with args: {:?}",
      instance.name,
      processor_path.display(),
      cmd_base
    );

    let output = cmd_base.output()?;

    if !output.stdout.is_empty() {
      println!(
        "[{}] Processor stdout: {}",
        instance.name,
        String::from_utf8_lossy(&output.stdout)
      );
    }

    if !output.stderr.is_empty() {
      println!(
        "[{}] Processor stderr: {}",
        instance.name,
        String::from_utf8_lossy(&output.stderr)
      );
    }

    if !output.status.success() {
      println!(
        "[{}] Processor failed with exit code: {:?}",
        instance.name,
        output.status.code()
      );
      return Err(InstanceError::ProcessorExecutionFailed.into());
    }
  }

  Ok(())
}
