use crate::utils::sys_info;
use partial_derive::Partial;
use serde::{Deserialize, Serialize};
use std::{fmt, path::PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MemoryInfo {
  pub total: u64,
  pub used: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JavaInfo {
  pub name: String,       // JDK/JRE + full version
  pub major_version: i32, // major version + LTS flag
  pub is_lts: bool,
  pub exec_path: String,
  pub vendor: String,
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
  #[strikethrough[serde(rename_all = "camelCase", deny_unknown_fields)]]
  pub struct GameConfig {
    pub game_java: struct {
      pub auto: bool,
      pub exec_path: String,
    },
    pub game_window: struct {
      pub resolution: struct {
        pub width: u32,
        pub height: u32,
        pub fullscreen: bool,
      },
      pub custom_title: String,
      pub custom_info: String,
    },
    pub performance: struct {
      pub auto_mem_allocation: bool,
      pub min_mem_allocation: u32,
      pub process_priority: String,
    },
    pub game_server: struct {
      pub auto_join: bool,
      pub server_url: String,
    },
    pub version_isolation: bool,
    pub launcher_visibility: String,
    pub display_game_log: bool,
    pub advanced_options: struct {
      pub enabled: bool,
    }
  }
}

#[derive(Partial, Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GameDirectory {
  pub name: String,
  pub dir: PathBuf,
}

structstruck::strike! {
  #[strikethrough[derive(Partial, Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]]
  #[strikethrough[serde(rename_all = "camelCase", deny_unknown_fields)]]
  pub struct LauncherConfig {
    pub version: String,
    // mocked: false when invoked from the backend, true when the frontend placeholder data is used during loading.
    pub mocked: bool,
    pub run_count: usize,
    pub appearance: struct AppearanceConfig {
      pub theme: struct {
        pub primary_color: String,
        pub color_mode: String,
        pub head_nav_style: String,
      },
      pub background: struct {
        pub choice: String,
      },
      pub accessibility: struct {
        pub invert_colors: bool,
        pub enhance_contrast: bool,
      }
    },
    pub download: struct DownloadConfig {
      pub source: struct {
        pub strategy: String,
      },
      pub transmission: struct {
        pub auto_concurrent: bool,
        pub concurrent_count: usize,
        pub enable_speed_limit: bool,
        pub speed_limit_value: usize,
      },
      pub cache: struct {
        pub directory: PathBuf,
      },
      pub proxy: struct {
        pub enabled: bool,
        pub selected_type: String,
        pub host: String,
        pub port: usize,
      }
    },
    pub general: struct GeneralConfig {
      pub general: struct {
        pub language: String,
      },
      pub optional_functions: struct {
        pub discover: bool,
      }
    },
    pub global_game_config: GameConfig,
    pub local_game_directories: Vec<GameDirectory>,
    pub states: struct States {
      pub accounts_page: struct {
        pub view_type: String
      },
      pub all_games_page: struct {
        pub view_type: String
      },
      pub game_version_selector: struct {
        pub game_types: Vec<String>
      },
      pub instance_mods_page: struct {
        pub accordion_states: [bool; 2],
      },
      pub instance_resourcepack_page: struct {
        pub accordion_states: [bool; 2],
      },
      pub instance_worlds_page: struct {
        pub accordion_states: [bool; 2],
      },
    }
  }
}

impl Default for GameConfig {
  fn default() -> Self {
    Self {
      game_java: GameJava {
        auto: true,
        exec_path: "".to_string(),
      },
      game_window: GameWindow {
        resolution: Resolution {
          width: 1280,
          height: 720,
          fullscreen: false,
        },
        custom_title: "".to_string(),
        custom_info: "".to_string(),
      },
      performance: Performance {
        auto_mem_allocation: true,
        min_mem_allocation: 1024,
        process_priority: "middle".to_string(),
      },
      game_server: GameServer {
        auto_join: false,
        server_url: "".to_string(),
      },
      version_isolation: true,
      launcher_visibility: "start-close".to_string(),
      display_game_log: false,
      advanced_options: AdvancedOptions { enabled: false },
    }
  }
}

impl Default for LauncherConfig {
  fn default() -> Self {
    Self {
      version: "dev".to_string(),
      mocked: false,
      run_count: 0,
      appearance: AppearanceConfig {
        theme: Theme {
          primary_color: "blue".to_string(),
          color_mode: "light".to_string(),
          head_nav_style: "standard".to_string(),
        },
        background: Background {
          choice: "%built-in:Jokull".to_string(),
        },
        accessibility: Accessibility {
          invert_colors: false,
          enhance_contrast: false,
        },
      },
      download: DownloadConfig {
        source: Source {
          strategy: "auto".to_string(),
        },
        transmission: Transmission {
          auto_concurrent: true,
          concurrent_count: 64,
          enable_speed_limit: false,
          speed_limit_value: 1024,
        },
        cache: Cache {
          directory: PathBuf::default(),
        },
        proxy: Proxy {
          enabled: false,
          selected_type: "http".to_string(),
          host: "127.0.0.1".to_string(),
          port: 80,
        },
      },
      general: GeneralConfig {
        general: General {
          language: sys_info::get_mapped_locale(),
        },
        optional_functions: OptionalFunctions { discover: false },
      },
      global_game_config: GameConfig::default(),
      local_game_directories: vec![],
      states: States {
        accounts_page: AccountsPage {
          view_type: "grid".to_string(),
        },
        all_games_page: AllGamesPage {
          view_type: "list".to_string(),
        },
        game_version_selector: GameVersionSelector {
          game_types: ["release".to_string()].to_vec(),
        },
        instance_mods_page: InstanceModsPage {
          accordion_states: [true, true],
        },
        instance_resourcepack_page: InstanceResourcepackPage {
          accordion_states: [true, true],
        },
        instance_worlds_page: InstanceWorldsPage {
          accordion_states: [true, true],
        },
      },
    }
  }
}

#[derive(Debug)]
pub enum LauncherConfigError {
  FetchError,
  InvalidCode,
  CodeExpired,
  VersionMismatch,
}

impl fmt::Display for LauncherConfigError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      LauncherConfigError::FetchError => write!(f, "FETCH_ERROR"),
      LauncherConfigError::InvalidCode => write!(f, "INVALID_CODE"),
      LauncherConfigError::CodeExpired => write!(f, "CODE_EXPIRED"),
      LauncherConfigError::VersionMismatch => write!(f, "VERSION_MISMATCH"),
    }
  }
}

impl std::error::Error for LauncherConfigError {}
