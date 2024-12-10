use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MemoryInfo {
  pub total: u64,
  pub used: u64,
}

structstruck::strike! {
  #[strikethrough[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]]
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

structstruck::strike! {
  #[strikethrough[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]]
  #[strikethrough[serde(rename_all = "camelCase", deny_unknown_fields)]]
  pub struct LauncherConfig {
    pub version: String,
    pub mocked: bool,
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
      pub download: struct {
        pub auto_concurrent: bool,
        pub concurrent_count: usize,
        pub enable_speed_limit: bool,
        pub speed_limit_value: usize,
      },
      pub cache: struct {
        pub directory: String,
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
    pub page: struct Page {
      pub accounts: struct {
        pub view_type: String
      },
      pub games: struct {
        pub view_type: String
      },
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
        download: Download {
          auto_concurrent: true,
          concurrent_count: 64,
          enable_speed_limit: false,
          speed_limit_value: 1024,
        },
        cache: Cache {
          directory: "/mock/path/to/cache/".to_string(),
        },
      },
      general: GeneralConfig {
        general: General {
          language: "zh-Hans".to_string(),
        },
        optional_functions: OptionalFunctions { discover: false },
      },
      global_game_config: GameConfig::default(),
      page: Page {
        accounts: Accounts {
          view_type: "grid".to_string(),
        },
        games: Games {
          view_type: "list".to_string(),
        },
      },
    }
  }
}
