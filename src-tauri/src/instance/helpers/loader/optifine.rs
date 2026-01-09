use crate::error::SJMCLResult;
use crate::instance::helpers::client_json::{ArgumentsItem, LaunchArgumentTemplate};
use crate::instance::helpers::client_json::{LibrariesValue, McClientInfo};
use crate::instance::helpers::loader::common::add_library_entry;
use crate::instance::helpers::misc::{get_instance_game_config, get_instance_subdir_paths};
use crate::instance::models::misc::{Instance, InstanceError, InstanceSubdirType, ModLoaderType};
use crate::launch::helpers::file_validator::convert_library_name_to_path;
use crate::launch::helpers::jre_selector::select_java_runtime;
use crate::launcher_config::models::JavaInfo;
use crate::launcher_config::models::LauncherConfig;
use crate::resource::helpers::misc::get_source_priority_list;
use crate::resource::helpers::misc::{convert_url_to_target_source, get_download_api};
use crate::resource::models::{OptiFineResourceInfo, ResourceType, SourceType};
use crate::tasks::commands::schedule_progressive_task_group;
use crate::tasks::download::DownloadParam;
use crate::tasks::PTaskParam;
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use zip::{write::FileOptions, ZipArchive, ZipWriter};

pub async fn download_optifine_installer(
  game_version: &str,
  optifine: &OptiFineResourceInfo,
  lib_dir: PathBuf,
  task_params: &mut Vec<PTaskParam>,
) -> SJMCLResult<()> {
  // only have BMCLAPI source
  let root = get_download_api(SourceType::BMCLAPIMirror, ResourceType::OptiFine)?;
  let installer_url = root.join(&format!(
    "{}/{}/{}",
    game_version, optifine.r#type, optifine.patch
  ))?;

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

async fn download_optifine_libraries(
  app: &AppHandle,
  priority: &[SourceType],
  instance: &Instance,
  client_info: &McClientInfo,
) -> SJMCLResult<()> {
  let mut client_info = client_info.clone();
  let optifine = instance
    .optifine
    .as_ref()
    .ok_or(InstanceError::ClientJsonParseError)?;

  let subdirs = get_instance_subdir_paths(
    app,
    instance,
    &[&InstanceSubdirType::Root, &InstanceSubdirType::Libraries],
  )
  .ok_or(InstanceError::InvalidSourcePath)?;
  let [_root_dir, lib_dir] = subdirs.as_slice() else {
    return Err(InstanceError::InvalidSourcePath.into());
  };

  let mut task_params: Vec<PTaskParam> = vec![];
  let installer_coord = format!("net.minecraftforge:optifine:{}", optifine.filename);
  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = lib_dir.join(&installer_rel);

  if !installer_path.exists() {
    return Err(InstanceError::ProcessorExecutionFailed.into());
  }
  let mut has_launchwrapper = false;
  let mut lw_coord = "".to_string();
  {
    let file = std::fs::File::open(&installer_path)?;
    let mut archive = ZipArchive::new(file)?;
    let ver_opt: Option<String> = match archive.by_name("launchwrapper-of.txt") {
      Ok(mut txt) => {
        let mut s = String::new();
        txt.read_to_string(&mut s)?;
        let v = s.trim().to_string();
        if v.is_empty() {
          None
        } else {
          Some(v)
        }
      }
      Err(_) => None,
    };

    if let Some(ver) = ver_opt {
      let jar_name = format!("launchwrapper-of-{}.jar", ver);

      if let Ok(mut lwo) = archive.by_name(&jar_name) {
        let lwo_coord = format!("optifine:launchwrapper-of:{}", ver);
        lw_coord = lwo_coord.clone();
        let lwo_rel = convert_library_name_to_path(&lwo_coord, None)?;
        let lwo_path = lib_dir.join(lwo_rel);
        if let Some(p) = lwo_path.parent() {
          if !p.exists() {
            fs::create_dir_all(p)?;
          }
        }
        let mut out = std::fs::File::create(&lwo_path)?;
        std::io::copy(&mut lwo, &mut out)?;
        has_launchwrapper = true;

        add_library_entry(&mut client_info.libraries, &lwo_coord, None)?;
      }
    }

    if !has_launchwrapper {
      if let Ok(mut lw2) = archive.by_name("launchwrapper-2.0.jar") {
        let lw2_coord = "optifine:launchwrapper:2.0".to_string();
        lw_coord = lw2_coord.clone();
        let lw2_rel = convert_library_name_to_path(&lw2_coord, None)?;
        let lw2_path = lib_dir.join(lw2_rel);
        if let Some(p) = lw2_path.parent() {
          if !p.exists() {
            fs::create_dir_all(p)?;
          }
        }
        let mut out = std::fs::File::create(&lw2_path)?;
        std::io::copy(&mut lw2, &mut out)?;
        has_launchwrapper = true;

        add_library_entry(&mut client_info.libraries, &lw2_coord, None)?;
      }
    }
  }

  if !has_launchwrapper {
    lw_coord = "net.minecraft:launchwrapper:1.12".to_string();
    add_library_entry(&mut client_info.libraries, &lw_coord, None)?;

    let lw_rel = convert_library_name_to_path(&lw_coord, None)?;
    let lw_dest = lib_dir.join(&lw_rel);

    let base = get_download_api(priority[0], ResourceType::Libraries)?;
    let src = convert_url_to_target_source(
      &base.join(&lw_rel)?,
      &[ResourceType::Libraries],
      &priority[0],
    )?;

    task_params.push(PTaskParam::Download(DownloadParam {
      src,
      dest: lw_dest,
      filename: None,
      sha1: None,
    }));
  }

  let optifine_runtime_coord = format!("net.minecraftforge:optifine:{}", optifine.filename);
  add_library_entry(&mut client_info.libraries, &optifine_runtime_coord, None)?;
  let lw_main = "net.minecraft.launchwrapper.Launch".to_string();

  if let Some(v_args) = client_info.arguments.clone() {
    let mut g: Vec<ArgumentsItem> = v_args.game.clone();
    let flag = ArgumentsItem {
      value: vec!["--tweakClass".to_string()],
      rules: vec![],
    };
    let val = if instance.mod_loader.loader_type == ModLoaderType::Forge {
      ArgumentsItem {
        value: vec!["optifine.OptiFineForgeTweaker".to_string()],
        rules: vec![],
      }
    } else {
      ArgumentsItem {
        value: vec!["optifine.OptiFineTweaker".to_string()],
        rules: vec![],
      }
    };

    if let Some(pos) = g.iter().position(|item| {
      item
        .value
        .first()
        .map(|v| v == "--launchTarget")
        .unwrap_or(false)
    }) {
      g.insert(pos, val);
      g.insert(pos, flag);
    } else {
      g.insert(0, val);
      g.insert(0, flag);
    }

    let new_args = LaunchArgumentTemplate {
      game: g,
      jvm: v_args.jvm.clone(),
    };
    client_info.arguments = Some(new_args);
  } else {
    let mut s = client_info.minecraft_arguments.clone().unwrap_or_default();
    if !s.is_empty() && !s.ends_with(' ') {
      s.push(' ');
    }
    if instance.mod_loader.loader_type == ModLoaderType::Forge {
      s.push_str("--tweakClass optifine.OptiFineForgeTweaker");
    } else {
      s.push_str("--tweakClass optifine.OptiFineTweaker");
    }
    client_info.minecraft_arguments = Some(s);
  };

  let (patch_arguments, patch_minecraft_arguments) = if client_info.arguments.is_some() {
    let patch_args = LaunchArgumentTemplate {
      game: vec![
        ArgumentsItem {
          value: vec!["--tweakClass".to_string()],
          rules: vec![],
        },
        ArgumentsItem {
          value: vec!["optifine.OptiFineTweaker".to_string()],
          rules: vec![],
        },
      ],
      jvm: vec![],
    };
    (Some(patch_args), None)
  } else {
    (
      None,
      Some("--tweakClass optifine.OptiFineTweaker".to_string()),
    )
  };

  client_info.patches.push(McClientInfo {
    id: "optifine".to_string(),
    version: Some(optifine.version.clone()),
    priority: Some(10000),
    main_class: Some(lw_main.clone()),
    arguments: patch_arguments,
    minecraft_arguments: patch_minecraft_arguments,
    libraries: vec![
      LibrariesValue {
        name: optifine_runtime_coord.clone(),
        ..Default::default()
      },
      LibrariesValue {
        name: lw_coord.clone(),
        ..Default::default()
      },
    ],
    ..Default::default()
  });
  if client_info.main_class == Some("net.minecraft.client.main.Main".to_string()) {
    client_info.main_class = Some(lw_main.clone());
  }

  if !task_params.is_empty() {
    schedule_progressive_task_group(
      app.clone(),
      format!("optifine-libraries?{}", instance.id),
      task_params,
      true,
    )
    .await?;
  }

  let vjson_path = instance
    .version_path
    .join(format!("{}.json", instance.name));
  fs::write(vjson_path, serde_json::to_vec_pretty(&client_info)?)?;

  Ok(())
}

async fn run_optifine_patcher(
  app: &AppHandle,
  instance: &Instance,
  client_info: &McClientInfo,
  installer_jar: &Path,
  base_client_jar: &Path,
  out_optifine_jar: &Path,
) -> SJMCLResult<()> {
  let javas_state = app.state::<Mutex<Vec<JavaInfo>>>();
  let javas = javas_state.lock()?.clone();

  let game_config = get_instance_game_config(app, instance);

  let selected_java = select_java_runtime(
    app,
    &game_config.game_java,
    &javas,
    instance,
    client_info
      .java_version
      .as_ref()
      .ok_or(InstanceError::ProcessorExecutionFailed)?
      .major_version,
  )
  .await?;

  let mut cmd = Command::new(&selected_java.exec_path);

  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x08000000);
  }

  cmd
    .arg("-cp")
    .arg(installer_jar)
    .arg("optifine.Patcher")
    .arg(base_client_jar)
    .arg(installer_jar)
    .arg(out_optifine_jar);

  let output = cmd.output()?;

  if !output.status.success() {
    return Err(InstanceError::ProcessorExecutionFailed.into());
  }
  Ok(())
}

pub async fn finish_optifine_install(
  app: &AppHandle,
  instance: &Instance,
  client_info: &McClientInfo,
) -> SJMCLResult<()> {
  let subdirs = get_instance_subdir_paths(app, instance, &[&InstanceSubdirType::Libraries])
    .ok_or(InstanceError::InstanceNotFoundByID)?;
  let libraries_dir = subdirs.first().ok_or(InstanceError::InstanceNotFoundByID)?;
  let optifine = instance
    .optifine
    .as_ref()
    .ok_or(InstanceError::ModLoaderVersionParseError)?;
  let installer_coord = format!(
    "net.minecraftforge:optifine:{}-installer",
    optifine.filename
  );
  let optifine_coord = format!("net.minecraftforge:optifine:{}", optifine.filename);
  let installer_rel = convert_library_name_to_path(&installer_coord, None)?;
  let installer_path = libraries_dir.join(&installer_rel);
  let optifine_rel = convert_library_name_to_path(&optifine_coord, None)?;
  let optifine_path = libraries_dir.join(&optifine_rel);
  if !installer_path.exists() {
    return Err(InstanceError::LoaderInstallerNotFound.into());
  }

  let f = fs::File::open(&installer_path)?;
  let mut archive = ZipArchive::new(f)?;

  let candidate = "optifine/Patcher.class";
  let has_patcher = archive.by_name(candidate).is_ok();

  let base_client_jar = instance.version_path.join(format!("{}.jar", instance.name));

  if let Some(parent) = optifine_path.parent() {
    std::fs::create_dir_all(parent)?;
  }
  if has_patcher {
    run_optifine_patcher(
      app,
      instance,
      client_info,
      &installer_path,
      &base_client_jar,
      &optifine_path,
    )
    .await?;
  } else {
    fs::copy(&installer_path, &optifine_path)?;
  }

  remove_entry_from_zip(&optifine_path, "META-INF/mods.toml")?;

  let priority_list = {
    let launcher_config_state = app.state::<Mutex<LauncherConfig>>();
    let launcher_config = launcher_config_state.lock()?;
    get_source_priority_list(&launcher_config)
  };

  download_optifine_libraries(app, &priority_list, instance, client_info).await?;

  Ok(())
}

fn remove_entry_from_zip(zip_path: &Path, entry_name: &str) -> SJMCLResult<()> {
  if !zip_path.exists() {
    return Ok(());
  }

  let tmp_path = {
    let mut p = zip_path.to_path_buf();
    let ext = p
      .extension()
      .map(|e| e.to_string_lossy().to_string())
      .unwrap_or_else(|| "jar".to_string());
    p.set_extension(format!("{}.tmp", ext));
    p
  };

  let src = fs::File::open(zip_path)?;
  let mut archive = ZipArchive::new(src)?;

  let dst = fs::File::create(&tmp_path)?;
  let mut writer = ZipWriter::new(dst);

  for i in 0..archive.len() {
    let mut file = archive.by_index(i)?;
    let name = file.name().to_string();

    if name == entry_name {
      continue;
    }
    if name.ends_with('/') {
      writer.add_directory(name, FileOptions::<()>::default())?;
      continue;
    }

    let options = FileOptions::<()>::default().compression_method(file.compression());
    writer.start_file(name, options)?;
    io::copy(&mut file, &mut writer)?;
  }

  writer.finish()?;
  fs::rename(&tmp_path, zip_path)?;

  Ok(())
}
