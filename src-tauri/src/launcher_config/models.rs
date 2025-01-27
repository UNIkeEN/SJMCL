use partial_derive::Partial;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri_plugin_os::locale;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MemoryInfo {
  pub total: u64,
  pub used: u64,
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
    pub performance: struct {
      pub game_window_resolution: struct {
        pub width: u32,
        pub height: u32,
        pub fullscreen: bool,
      },
      pub auto_mem_allocation: bool,
      pub min_mem_allocation: u32,
      pub process_priority: String,
    },
    pub version_isolation: struct {
      pub enabled: bool,
      pub isolation_strategy: String,
    },
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
        pub head_nav_style: String,
      },
      pub background: struct {
        pub preset_choice: String,
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
      }
    }
  }
}

impl Default for GameConfig {
  fn default() -> Self {
    Self {
      performance: Performance {
        game_window_resolution: GameWindowResolution {
          width: 1280,
          height: 720,
          fullscreen: false,
        },
        auto_mem_allocation: true,
        min_mem_allocation: 1024,
        process_priority: "middle".to_string(),
      },
      version_isolation: VersionIsolation {
        enabled: true,
        isolation_strategy: "full".to_string(),
      },
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
          head_nav_style: "standard".to_string(),
        },
        background: Background {
          preset_choice: "Jokull".to_string(),
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
      },
      general: GeneralConfig {
        general: General {
          language: match locale().unwrap().as_str() {
            "zh-CN" => "zh-Hans".to_string(),
            "zh-TW" => "zh-Hant".to_string(),
            "zh-HK" => "zh-Hant".to_string(),
            "zh-MO" => "zh-Hant".to_string(),
            _ => "en".to_string(),
          },
        },
        optional_functions: OptionalFunctions { discover: false },
      },
      global_game_config: GameConfig::default(),
      local_game_directories: vec![GameDirectory {
        name: "CURRENT_DIR".to_string(),
        dir: PathBuf::from(".minecraft"),
      }],
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
      },
    }
  }
}
