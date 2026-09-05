use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sjmcl_macros::Partial;
use sjmcl_migration::migrate;
use sjmcl_types::partial::PartialUpdate;
use sjmcl_types::storage::Storage;
use smart_default::SmartDefault;
use std::fs;
use std::path::PathBuf;
use strum_macros::{Display, EnumString};
use tauri::{AppHandle, Emitter};

use crate::launcher_config::constants::{CONFIG_PARTIAL_UPDATE_EVENT, LAUNCHER_CFG_FILE_NAME};
use crate::utils::string::snake_to_camel_case;
use crate::utils::sys_info;
use crate::{APP_DATA_DIR, EXE_DIR, IS_PORTABLE};

// Partial Derive is used for these structs and we can use it for key value storage.
// And partially update some fields for better performance and hygiene.
//
// let mut config = GameConfig::new();
// assert!(config.access("game_window_resolution.width").is_ok());
// let result_game = config.update("game_window_resolution.width", 1920);
// assert_eq!(result_game, Ok(()));
// assert!(config.access("114514").is_err())
//
sjmcl_macros::migrations! {
  // Pre-1.2.0 config files carry no `version` key and fall back to the
  // chain-start version (v1.0.0) when migrated. The legacy field conversions
  // (old built-in backgrounds, old discover source format) are applied by the
  // customized migration helpers in the final step that restores v1.2.0.
  schema v1.2.0 {
    #[structstruck::each[derive(Partial, Debug, PartialEq, Eq, Clone, Deserialize, Serialize, SmartDefault)]]
    #[structstruck::each[serde(rename_all = "camelCase", default)]]
    pub struct LauncherConfig {
      #[default(_code = "__migration_meta::MAX_VERSION.to_string()")]
      pub version: String,
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
        #[serde(default)]
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
      #[serde(default)]
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
    #[structstruck::each[derive(Partial, Debug, PartialEq, Eq, Clone, Deserialize, Serialize, SmartDefault)]]
    #[structstruck::each[serde(rename_all = "camelCase", default)]]
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
  // Auxiliary types: generated as real Rust types and referenceable as field
  // types, but not part of the migration symbol table.
  #[aux]
  #[derive(Debug, Serialize, Deserialize, Default)]
  #[serde(rename_all = "camelCase", deny_unknown_fields)]
  pub struct VersionMetaInfo {
    pub version: String,
    pub file_name: String,
    pub release_notes: String,
    pub published_at: String,
  }

  #[aux]
  #[derive(Debug, Serialize)]
  #[serde(rename_all = "camelCase", deny_unknown_fields)]
  pub struct MemoryInfo {
    pub total: u64,
    pub used: u64,
    pub suggested_max_alloc: u64,
  }

  #[aux]
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
  #[aux]
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

  #[aux]
  #[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
  #[serde(rename_all = "camelCase")]
  pub enum FileValidatePolicy {
    Disable,
    Full,
    #[serde(other)]
    Normal,
  }

  #[aux]
  #[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
  #[serde(rename_all = "camelCase")]
  pub enum LauncherVisiablity {
    StartHidden,
    RunningHidden,
    Always,
  }

  #[aux]
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

  #[aux]
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
  #[aux]
  #[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
  #[serde(rename_all = "camelCase")]
  pub enum ProxyType {
    Socks,
    #[serde(other)]
    Http,
  }

  #[aux]
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
  }
  // Pre-1.2.0 configs carry no `version` key and fall back to the chain start
  // (v1.0.0) during migration. The legacy field conversions are applied by the
  // customized migration helpers below when restoring v1.2.0.
  v1.0.0 -> v1.1.0 {}
  v1.1.0 -> v1.2.0 {
    convert "appearance.background" from AppearanceBackgroundConfig to AppearanceBackgroundConfig => crate::launcher_config::migrations::migrate_background;
    convert "discoverSourceEndpoints" from Vec<String> to Vec<(String, bool)> => crate::launcher_config::migrations::migrate_discover_sources;
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

  fn load() -> Result<Self, std::io::Error>
  where
    Self: Sized + DeserializeOwned,
  {
    let json_string = fs::read_to_string(Self::file_path())?;
    let mut value: Value = serde_json::from_str(&json_string)?;
    // Config files written before 1.2.0 carry no `version` key; migrate() falls
    // back to the chain-start version and applies the declared steps.
    migrate(&mut value, &MIGRATIONS, None, "version").map_err(std::io::Error::other)?;
    serde_json::from_value(value).map_err(std::io::Error::other)
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn migration_chain_covers_pre_1_2_0_versions() {
    assert_eq!(MIGRATIONS.len(), 2);
    assert_eq!((MIGRATIONS[0].from.major, MIGRATIONS[0].from.minor), (1, 0));
    assert_eq!((MIGRATIONS[1].to.major, MIGRATIONS[1].to.minor), (1, 2));
    assert_eq!(__migration_meta::MAX_VERSION.major, 1);
    assert_eq!(__migration_meta::MAX_VERSION.minor, 2);
  }

  #[test]
  fn migrate_fills_version_for_legacy_config() {
    // A pre-1.2.0 config has no `version` key; migrate() falls back to the
    // chain-start version and stamps the current version onto the document.
    let mut doc: Value = serde_json::json!({
      "mocked": true,
    });
    migrate(&mut doc, &MIGRATIONS, None, "version").unwrap();
    assert_eq!(doc["version"], "1.2.0");
  }

  #[test]
  fn migrate_keeps_current_version_unchanged() {
    let mut doc: Value = serde_json::json!({
      "version": "1.2.0",
      "mocked": true,
    });
    migrate(&mut doc, &MIGRATIONS, None, "version").unwrap();
    assert_eq!(doc["version"], "1.2.0");
  }

  #[test]
  fn migrate_applies_legacy_field_conversions() {
    // A pre-1.2.0 config with legacy built-in backgrounds and old
    // discover source string format; the custom ops restore them to 1.2.0.
    let mut doc: Value = serde_json::json!({
      "appearance": {
        "background": {
          "choice": "%built-in:Jokull",
          "randomCustom": true,
          "autoDarken": true,
        }
      },
      "discoverSourceEndpoints": [
        "https://mc.sjtu.cn/api-sjmcl/article",
        "https://mc.sjtu.cn/api-sjmcl/article/mua",
      ],
    });
    migrate(&mut doc, &MIGRATIONS, None, "version").unwrap();

    assert_eq!(doc["version"], "1.2.0");
    assert_eq!(
      doc["appearance"]["background"]["choice"],
      "%built-in:Florwyn"
    );
    assert_eq!(doc["appearance"]["background"]["autoDarken"], false);
    assert_eq!(
      doc["discoverSourceEndpoints"][0],
      serde_json::json!(["https://mc.sjtu.cn/api-sjmcl/article", true,])
    );
  }
}
