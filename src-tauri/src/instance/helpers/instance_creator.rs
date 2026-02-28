use crate::error::SJMCLResult;
use crate::instance::helpers::client_json::{replace_native_libraries, McClientInfo};
use crate::instance::helpers::loader::common::install_mod_loader;
use crate::instance::helpers::loader::optifine::download_optifine_installer;
use crate::instance::helpers::modpack::misc::{extract_overrides, get_download_params};
use crate::instance::helpers::{misc, options_txt};
use crate::instance::models::misc::InstanceSubdirType;
use crate::instance::models::misc::{
  Instance, InstanceError, ModLoader, ModLoaderStatus, ModLoaderType, OptiFine,
};
use crate::launch::helpers::file_validator;
use crate::launcher_config::models::GameDirectory;
use crate::resource::helpers::misc::get_source_priority_list;
use crate::resource::models::{
  GameClientResourceInfo, ModLoaderResourceInfo, OptiFineResourceInfo, SourceType,
};
use crate::storage::save_json_async;
use crate::tasks::commands::schedule_progressive_task_group;
use crate::tasks::download::DownloadParam;
use crate::tasks::PTaskParam;
use crate::LauncherConfig;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri::{AppHandle, State};
use tauri_plugin_http::reqwest::{self, Client};
use url::Url;

pub async fn create_instance(
  app: AppHandle,
  directory: GameDirectory,
  name: String,
  description: String,
  icon_src: String,
  game: GameClientResourceInfo,
  mod_loader: ModLoaderResourceInfo,
  optifine: Option<OptiFineResourceInfo>,
  modpack_path: Option<String>,
  is_install_fabric_api: Option<bool>,
) -> SJMCLResult<()> {
  let (client, launcher_config_state, priority_list) = init(&app)?;

  // Ensure the instance name is unique
  let version_path = directory.dir.join("versions").join(&name);
  if version_path.exists() {
    return Err(InstanceError::ConflictNameError.into());
  }

  // Create instance config
  let instance = Instance::new(
    &optifine,
    directory,
    name.clone(),
    description,
    icon_src,
    &game,
    &version_path,
    &mod_loader,
  );

  // Download version info
  let mut version_info = get_version_info(&client, &game, name.clone()).await?;

  let mut task_params = Vec::<PTaskParam>::new();

  // Download client (use task)
  task_params.download_client(&version_info, &instance, &name)?;

  let subdirs = get_subdirs(&app, &instance)?;
  let [libraries_dir, assets_dir, mods_dir] = subdirs.as_slice() else {
    return Err(InstanceError::InstanceNotFoundByID.into());
  };

  replace_native_libraries(&app, &mut version_info, &instance)
    .await
    .map_err(|_| InstanceError::ClientJsonParseError)?;

  task_params
    .download_resources(
      &app,
      priority_list[0],
      &version_info,
      libraries_dir,
      assets_dir,
    )
    .await?;

  // download loader (installer)
  if instance.mod_loader.loader_type != ModLoaderType::Unknown {
    install_mod_loader(
      app.clone(),
      &priority_list,
      &instance.version,
      &instance.mod_loader,
      libraries_dir.to_path_buf(),
      mods_dir.to_path_buf(),
      &mut version_info,
      &mut task_params,
      is_install_fabric_api,
    )
    .await?;
  }

  if let Some(info) = optifine.as_ref() {
    download_optifine_installer(
      &instance.version,
      info,
      libraries_dir.to_path_buf(),
      &mut task_params,
    )
    .await?;
  }

  // If modpack path is provided, install it
  if let Some(modpack_path) = modpack_path {
    let path = PathBuf::from(modpack_path);
    let file = fs::File::open(&path).map_err(|_| InstanceError::FileNotFoundError)?;
    task_params.extend(get_download_params(&app, &file, &version_path).await?);
    extract_overrides(&file, &version_path)?;
  }

  schedule_progressive_task_group(
    app.clone(),
    format!("game-client?{}", name),
    task_params,
    true,
  )
  .await?;

  // Optionally skip first-screen options by adding options.txt (available for zh-Hans only)
  let (language, skip_first_screen_options) = {
    let launcher_config = launcher_config_state.lock()?;
    (
      launcher_config.general.general.language.clone(),
      launcher_config
        .general
        .functionality
        .skip_first_screen_options,
    )
  };
  if language == "zh-Hans" && skip_first_screen_options {
    if let Some(lang_code) = options_txt::get_zh_hans_lang_tag(&instance.version, &app).await {
      let options_path =
        misc::get_instance_subdir_paths(&app, &instance, &[&InstanceSubdirType::Root])
          .ok_or(InstanceError::InstanceNotFoundByID)?[0]
          .join("options.txt");
      if !options_path.exists() {
        if let Err(_) = fs::write(options_path, format!("lang:{}\n", lang_code)) {
          log::error!("Failed to write options.txt.");
        }
      }
    }
  }

  // Save the edited client json
  save_json_async(&version_info, &version_path.join(format!("{}.json", name))).await?;
  // Save the SJMCL instance config json
  instance
    .save_json_cfg()
    .await
    .map_err(|_| InstanceError::FileCreationFailed)?;

  Ok(())
}

fn init(
  app: &AppHandle,
) -> SJMCLResult<(
  State<'_, Client>,
  State<'_, Mutex<LauncherConfig>>,
  Vec<SourceType>,
)> {
  let client = app.state::<reqwest::Client>();
  let launcher_config_state = app.state::<Mutex<LauncherConfig>>();
  // Get priority list
  let priority_list = {
    let launcher_config = launcher_config_state.lock()?;
    get_source_priority_list(&launcher_config)
  };
  Ok((client, launcher_config_state, priority_list))
}

impl Instance {
  fn new(
    optifine: &Option<OptiFineResourceInfo>,
    directory: GameDirectory,
    name: String,
    description: String,
    icon_src: String,
    game: &GameClientResourceInfo,
    version_path: &PathBuf,
    mod_loader: &ModLoaderResourceInfo,
  ) -> Self {
    let optifine_info = optifine.as_ref().map(|info| OptiFine {
      filename: info.filename.clone(),
      version: format!("{}_{}", info.r#type, info.patch),
      status: ModLoaderStatus::NotDownloaded,
    });

    let instance = Instance {
      id: format!("{}:{}", directory.name, name.clone()),
      name: name.clone(),
      version: game.id.clone(),
      version_path: version_path.clone(),
      mod_loader: ModLoader {
        loader_type: mod_loader.loader_type.clone(),
        status: if matches!(
          mod_loader.loader_type,
          ModLoaderType::Unknown | ModLoaderType::Fabric
        ) {
          ModLoaderStatus::Installed
        } else {
          ModLoaderStatus::NotDownloaded
        },
        version: mod_loader.version.clone(),
        branch: mod_loader.branch.clone(),
      },
      optifine: optifine_info,
      description,
      icon_src,
      starred: false,
      play_time: 0,
      use_spec_game_config: false,
      spec_game_config: None,
    };
    instance
  }
}

async fn get_version_info(
  client: &Client,
  game: &GameClientResourceInfo,
  name: String,
) -> SJMCLResult<McClientInfo> {
  let mut version_info = client
    .get(&game.url)
    .send()
    .await
    .map_err(|_| InstanceError::NetworkError)?
    .json::<McClientInfo>()
    .await
    .map_err(|_| InstanceError::ClientJsonParseError)?;

  version_info.id = name.clone();
  version_info.jar = Some(name);

  let mut vanilla_patch = version_info.clone();
  vanilla_patch.id = "game".to_string();
  vanilla_patch.version = Some(game.id.clone());
  vanilla_patch.inherits_from = None;
  vanilla_patch.priority = Some(0);
  version_info.patches.push(vanilla_patch);

  Ok(version_info)
}

trait DownloadTask {
  fn download_client(
    &mut self,
    version_info: &McClientInfo,
    instance: &Instance,
    name: &str,
  ) -> SJMCLResult<()>;
  async fn download_resources(
    &mut self,
    app: &AppHandle,
    source: SourceType,
    version_info: &McClientInfo,
    libraries_dir: &PathBuf,
    assets_dir: &PathBuf,
  ) -> SJMCLResult<()>;
}

impl DownloadTask for Vec<PTaskParam> {
  fn download_client(
    &mut self,
    version_info: &McClientInfo,
    instance: &Instance,
    name: &str,
  ) -> SJMCLResult<()> {
    let client_download_info = version_info
      .downloads
      .get("client")
      .ok_or(InstanceError::ClientJsonParseError)?;

    self.push(PTaskParam::Download(DownloadParam {
      src: Url::parse(&client_download_info.url.clone())
        .map_err(|_| InstanceError::ClientJsonParseError)?,
      dest: instance.version_path.join(format!("{}.jar", name)),
      filename: None,
      sha1: Some(client_download_info.sha1.clone()),
    }));
    Ok(())
  }
  async fn download_resources(
    &mut self,
    app: &AppHandle,
    source: SourceType,
    version_info: &McClientInfo,
    libraries_dir: &PathBuf,
    assets_dir: &PathBuf,
  ) -> SJMCLResult<()> {
    // We only download libraries if they are invalid (not already downloaded)
    self.extend(
      file_validator::get_invalid_library_files(source, libraries_dir, &version_info, false)
        .await?,
    );

    // We only download assets if they are invalid (not already downloaded)
    self.extend(
      file_validator::get_invalid_assets(&app, &version_info, source, assets_dir, false).await?,
    );
    Ok(())
  }
}

fn get_subdirs(app: &AppHandle, instance: &Instance) -> SJMCLResult<Vec<PathBuf>> {
  let subdirs = misc::get_instance_subdir_paths(
    app,
    instance,
    &[
      &InstanceSubdirType::Libraries,
      &InstanceSubdirType::Assets,
      &InstanceSubdirType::Mods,
    ],
  )
  .ok_or(InstanceError::InstanceNotFoundByID)?;
  Ok(subdirs)
}
