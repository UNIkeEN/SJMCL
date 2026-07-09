use serde::{Deserialize, Serialize};
use sjmcl_macros::Partial;
use sjmcl_types::partial::PartialUpdate;
use sjmcl_types::storage::Storage;
use smart_default::SmartDefault;
use std::path::PathBuf;
use strum_macros::{Display, EnumString};
use tauri::{AppHandle, Emitter};

use crate::launcher_config::constants::{CONFIG_PARTIAL_UPDATE_EVENT, LAUNCHER_CFG_FILE_NAME};
use crate::launcher_config::migrations::{deserialize_background, deserialize_discover_sources};
use crate::utils::string::snake_to_camel_case;
use crate::utils::sys_info;
use crate::{APP_DATA_DIR, EXE_DIR, IS_PORTABLE};

// Info about the latest release version fetched from remote, shown to the user to update.
#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VersionMetaInfo {
  pub version: String,
  pub file_name: String,
  pub release_notes: String,
  pub published_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MemoryInfo {
  pub total: u64,
  pub used: u64,
  pub suggested_max_alloc: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JavaInfo {
  pub name: String, // JDK/JRE + full version
  pub exec_path: String,
  pub vendor: String,
  pub major_version: i32, // major version + LTS flag
  pub is_lts: bool,
  pub is_user_added: bool,
}

// https://github.com/HMCL-dev/HMCL/blob/d9e3816b8edf9e7275e4349d4fc67a5ef2e3c6cf/HMCLCore/src/main/java/org/jackhuang/hmcl/game/ProcessPriority.java#L20
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub enum ProcessPriority {
  Low,
  AboveNormal,
  BelowNormal,
  High,
  #[serde(other)]
  Normal,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub enum FileValidatePolicy {
  Disable,
  Full,
  #[serde(other)]
  Normal,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub enum LauncherVisiablity {
  StartHidden,
  RunningHidden,
  Always,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "lowercase")]
pub enum GarbageCollector {
  G1gc,
  Zgc,
  Shenandoah,
  Parallel,
  Serial,
  #[serde(other)]
  Auto,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "lowercase")]
pub enum GraphicsApi {
  Opengl,
  Vulkan,
  #[serde(other)]
  Default,
}

// see java.net.proxy
// https://github.com/HMCL-dev/HMCL/blob/d9e3816b8edf9e7275e4349d4fc67a5ef2e3c6cf/HMCLCore/src/main/java/org/jackhuang/hmcl/launch/DefaultLauncher.java#L114
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub enum ProxyType {
  Socks,
  #[serde(other)]
  Http,
}

#[derive(Partial, Debug, PartialEq, Eq, Clone, Deserialize, Serialize, SmartDefault)]
#[serde(default)]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfig {
  pub enabled: bool,
  #[default(ProxyType::Http)]
  pub selected_type: ProxyType,
  pub host: String,
  pub port: usize,
}

// Partial Derive is used for these structs and we can use it for key value storage.
// And partially update some fields for better performance and hygiene.
//
// let mut config = GameConfig::new();
// assert!(config.access("game_window_resolution.width").is_ok());
// let result_game = config.update("game_window_resolution.width", 1920);
// assert_eq!(result_game, Ok(()));
// assert!(config.access("114514").is_err())
//
structstruck::strike! {
  #[strikethrough[derive(Partial, Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]]
  #[strikethrough[serde(rename_all = "camelCase")]]
  #[strikethrough[derive(SmartDefault)]]
  #[strikethrough[serde(default)]]
  pub struct GameConfig {
    pub game_java: struct GameJava {
      #[default = true]
      pub auto: bool,
      pub exec_path: String,
    },
    pub game_window: struct {
      pub resolution: struct {
        #[default = 854]
        pub width: u32,
        #[default = 480]
        pub height: u32,
        pub fullscreen: bool,
      },
      pub custom_title: String,
      pub custom_info: String,
    },
    pub performance: struct {
      #[default = true]
      pub auto_mem_allocation: bool,
      #[default = 1024]
      pub max_mem_allocation: u32,
      #[default(ProcessPriority::Normal)]
      pub process_priority: ProcessPriority,
    },
    pub game_server: struct {
      pub auto_join: bool,
      pub server_url: String,
    },
    #[default = true]
    pub version_isolation: bool,
    #[default(LauncherVisiablity::Always)]
    pub launcher_visibility: LauncherVisiablity,
    pub display_game_log: bool,
    pub advanced_options: struct {
      pub enabled: bool,
    },
    pub advanced: struct {
      pub graphics: struct {
        #[default(GraphicsApi::Default)]
        pub api: GraphicsApi,
        #[default = "default"]
        pub renderer: String,
      },
      pub custom_commands: struct {
        pub minecraft_argument: String,
        pub precall_command: String,
        pub wrapper_launcher: String,
        pub post_exit_command: String,
      },
      pub proxy: ProxyConfig,
      pub jvm: struct {
        #[default(GarbageCollector::Auto)]
        pub garbage_collector: GarbageCollector,
        pub java_permanent_generation_space: u32,
        pub environment_variable: String,
        pub args: String,
      },
      pub workaround: struct GameWorkaroundConfig {
        pub no_jvm_args: bool,
        #[default(FileValidatePolicy::Normal)]
        pub game_file_validate_policy: FileValidatePolicy,
        pub dont_check_jvm_validity: bool,
        pub dont_patch_natives: bool,
        #[default = true]
        pub use_lwjgl_unsafe_agent: bool,
        pub use_custom_authlib_injector: struct {
          pub enabled: bool,
          pub path: String,
        },
        pub use_native_glfw: bool,
        pub use_native_openal: bool,
      },
    }
  }
}

#[derive(Partial, Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GameDirectory {
  pub name: String,
  pub dir: PathBuf,
}

// Build metadata: compile-time constants injected by build.rs.
// Values match frontend src/enums/misc.ts BuildType.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Default, EnumString, Display)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "kebab-case")]
pub enum BuildType {
  #[default]
  Dev,
  #[serde(rename = "test-build")]
  TestBuild,
  Nightly,
  Beta,
  Release,
}

structstruck::strike! {
  #[strikethrough[derive(Partial, Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]]
  #[strikethrough[serde(rename_all = "camelCase")]]
  #[strikethrough[derive(SmartDefault)]]
  #[strikethrough[serde(default)]]
  pub struct LauncherConfig {
    pub basic_info: struct {
      #[default = "dev"]
      pub launcher_version: String,
      pub platform: String,
      pub arch: String,
      pub os_type: String,
      pub platform_version: String,
      pub exe_sha256: String,
      pub is_portable: bool,
      #[default = true]
      pub is_exe_path_available: bool,
      #[default = false]
      pub is_china_mainland_ip: bool,
      #[default = false]
      pub allow_full_login_feature: bool,
      // Build metadata, sourced from compile-time constants injected by build.rs.
      // Filled by setup_with_app; not meant to be edited by the user.
      #[default(BuildType::Dev)]
      pub build_type: BuildType,
      pub build_commit_sha: String,
    },
    // mocked: false when invoked from the backend, true when the frontend placeholder data is used during loading.
    pub mocked: bool,
    pub run_count: usize,
    #[default = true]
    pub last_run_exited_normally: bool,
    pub appearance: struct AppearanceConfig {
      pub theme: struct {
        #[default = "blue"]
        pub primary_color: String,
        #[default = "light"]
        pub color_mode: String,
        pub use_liquid_glass_design: bool,
        #[default = "adaptive"]
        pub head_nav_style: String,
      },
      pub font: struct {
        #[default = "%built-in"]
        pub font_family: String,
        #[default = "%built-in"]
        pub log_font_family: String,
        #[default = 100]
        pub font_size: usize, // as percent
      },
      #[serde(
        default,
        deserialize_with = "deserialize_background"
      )]
      pub background: struct AppearanceBackgroundConfig {
        #[default = "%built-in:Florwyn"]
        pub choice: String,
        pub random_custom: bool,
        pub auto_darken: bool,
      },
      pub accessibility: struct {
        pub invert_colors: bool,
        pub enhance_contrast: bool,
      }
    },
    pub download: struct DownloadConfig {
      pub source: struct {
        #[default = "auto"]
        pub strategy: String,
      },
      pub transmission: struct {
        #[default = true]
        pub auto_concurrent: bool,
        #[default = 64]
        pub concurrent_count: usize,
        #[default = false]
        pub enable_speed_limit: bool,
        #[default = 1024]
        pub speed_limit_value: usize,
      },
      pub cache: struct {
        pub directory: PathBuf,
      },
      pub proxy: ProxyConfig,
    },
    pub general: struct GeneralConfig {
      pub general: struct {
        #[default(sys_info::get_mapped_locale())]
        pub language: String,
      },
      pub functionality: struct {
        #[default = "on"]
        pub discover_page: String,
        #[default = "instance"]
        pub instances_nav_type: String,
        #[default = true]
        pub launch_page_quick_switch: bool,
        #[default = true]
        pub auto_download_java: bool,
        #[default = true]
        pub resource_translation: bool, // only available in zh-Hans
        #[default = true]
        pub translated_filename_prefix: bool, // only available in zh-Hans
        #[default = true]
        pub skip_first_screen_options: bool,
      },
      pub advanced: struct GeneralConfigAdvanced {
        #[default = true]
        pub auto_purge_launcher_logs: bool,
      }
    },
    pub intelligence: struct IntelligenceConfig {
      pub mcp_server: struct {
        pub launcher: struct LauncherMcpServerConfig{
          #[default = true]
          pub enabled: bool,
          #[default = 18970]
          pub port: u16,
        },
      }
    },
    pub extension: struct ExtensionConfig {
      pub enabled: Vec<String>,
      #[serde(default)]
      pub home_widget_state: Vec<(String, u32, bool)>,  // widget_key, width, collapsed
    },
    pub global_game_config: GameConfig,
    pub local_game_directories: Vec<GameDirectory>,
    #[serde(
      default,
      deserialize_with = "deserialize_discover_sources"
    )]
    #[default(_code="vec![(\"https://mc.sjtu.cn/api-sjmcl/article\".to_string(), true),
    (\"https://mc.sjtu.cn/api-sjmcl/article/mua\".to_string(), true)]")]
    pub discover_source_endpoints: Vec<(String, bool)>,
    pub extra_java_paths: Vec<String>,
    pub suppressed_dialogs: Vec<String>,
    pub states: struct States {
      pub shared: struct {
        pub selected_player_id: String,
        pub selected_instance_id: String,
      },
      pub accounts_page: struct {
        #[default = "grid"]
        pub view_type: String
      },
      pub all_instances_page: struct {
        #[default = "versionAsc"]
        pub sort_by: String,
        #[default = "list"]
        pub view_type: String
      },
      pub game_version_selector: struct {
        #[default(_code="vec![\"release\".to_string()]")]
        pub game_types: Vec<String>
      },
      pub instance_mods_page: struct {
        #[default([true, true])]
        pub accordion_states: [bool; 2],
      },
      pub instance_resource_packs_page: struct {
        #[default([true, true])]
        pub accordion_states: [bool; 2],
      },
      pub instance_worlds_page: struct {
        #[default([true, true])]
        pub accordion_states: [bool; 2],
      },
      pub instance_shader_packs_page: struct {
        #[default([true, true])]
        pub accordion_states: [bool; 2],
      },
    }
  }
}

impl LauncherConfig {
  pub fn partial_update(
    &mut self,
    app: &AppHandle,
    key_path: &str,
    value: &str,
  ) -> Result<(), std::io::Error> {
    self
      .update(key_path, value)
      .map_err(std::io::Error::other)?;

    app
      .emit(
        CONFIG_PARTIAL_UPDATE_EVENT,
        serde_json::json!({
          "path": snake_to_camel_case(key_path),
          "value": value,
        }),
      )
      .map_err(std::io::Error::other)?;

    Ok(())
  }
}

impl Storage for LauncherConfig {
  fn file_path() -> PathBuf {
    if *IS_PORTABLE {
      EXE_DIR.join(LAUNCHER_CFG_FILE_NAME)
    } else {
      APP_DATA_DIR.get().unwrap().join(LAUNCHER_CFG_FILE_NAME)
    }
  }
}

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum LauncherConfigError {
  FetchError,
  InvalidCode,
  CodeExpired,
  VersionMismatch,
  GameDirAlreadyAdded,
  GameDirNotExist,
  JavaExecInvalid,
  HasActiveDownloadTasks,
  FileDeletionFailed,
}

impl std::error::Error for LauncherConfigError {}
