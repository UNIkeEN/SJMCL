use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use std::{path::PathBuf, sync::Mutex};
use tauri::State;

#[tauri::command]
pub fn get_launcher_config(state: State<'_, Mutex<LauncherConfig>>) -> LauncherConfig {
  state.lock().unwrap().clone()
}

#[tauri::command]
pub fn update_launcher_config(
  launcher_config: LauncherConfig,
  state: State<'_, Mutex<LauncherConfig>>,
) {
  let mut state = state.lock().unwrap();
  *state = launcher_config;
  save_config(&state);
}

#[tauri::command]
pub fn add_account(account: Account, state: State<'_, Mutex<LauncherConfig>>) {
  let mut state = state.lock().unwrap();
  (*state).accounts.push(account);
  save_config(&state);
}

#[tauri::command]
pub fn add_server(server: Server, state: State<'_, Mutex<LauncherConfig>>) {
  let mut state = state.lock().unwrap();
  (*state).servers.push(server);
  save_config(&state);
}

#[tauri::command]
pub fn edit_server(server: Server, state: State<'_, Mutex<LauncherConfig>>) {
  let mut state = state.lock().unwrap();
  for s in (*state).servers.iter_mut() {
    if s.id == server.clone().id && s.mutable {
      *s = server.clone();
      break;
    }
  }
  save_config(&state);
}

#[tauri::command]
pub fn remove_server(server_id: String, state: State<'_, Mutex<LauncherConfig>>) {
  let mut state = state.lock().unwrap();
  (*state).servers.retain(|s| !s.mutable || s.id != server_id);
  save_config(&state);
}

static CONFIG_PATH: LazyLock<PathBuf> = LazyLock::new(|| {
  std::env::current_exe()
    .unwrap()
    .parent()
    .unwrap()
    .join("launcher_config.json")
});

pub fn read_or_default() -> LauncherConfig {
  if let Ok(config) = std::fs::read_to_string(CONFIG_PATH.as_path()) {
    serde_json::from_str(&config).unwrap_or_default()
  } else {
    LauncherConfig::default()
  }
}

pub fn save_config(config: &LauncherConfig) {
  let config = serde_json::to_string_pretty(config).unwrap();
  std::fs::write(CONFIG_PATH.as_path(), config).unwrap();
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

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Server {
  pub name: String,
  pub id: String,
  pub auth_url: String,
  pub mutable: bool,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Account {
  pub name: String,
  pub uuid: String,
  pub avatar_url: String,
  pub server_type: String,
  pub auth_account: String,
}

structstruck::strike! {
  #[strikethrough[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]]
  #[strikethrough[serde(rename_all = "camelCase", deny_unknown_fields)]]
  pub struct LauncherConfig {
    pub version: String,
    pub mocked: bool,
    pub accounts: Vec<Account>,
    pub servers: Vec<Server>,
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
    pub global_game_config: GameConfig
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
      accounts: vec![],
      servers: vec![
        Server {
          id: "sjmc".to_string(),
          name: "SJMC 用户中心".to_string(),
          auth_url: "https://skin.mc.sjtu.cn/api/yggdrasil".to_string(),
          mutable: false,
        },
        Server {
          id: "mua".to_string(),
          name: "MUA 用户中心".to_string(),
          auth_url: "https://skin.mualliance.ltd/api/yggdrasil".to_string(),
          mutable: false,
        },
      ],
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
    }
  }
}
