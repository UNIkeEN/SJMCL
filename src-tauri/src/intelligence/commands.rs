use std::sync::Mutex;

use tauri::{ipc::Channel, AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::error::SJMCLResult;
use crate::intelligence::models::{
  ChatHistory, ChatMessage, ChatSession, ChatSessionSummary, LLMServiceError,
};
use crate::intelligence::providers::{self, StreamParseResult};
use crate::launcher_config::models::{
  IntelligenceConfig, LLMModelConfig, LLMProviderType, LauncherConfig, ProviderConfig,
};
use crate::storage::Storage;

// TODO: migrate log analysis logic to backend (w multi-language prompt and result parsing)

/// Returns enabled providers sorted by: active first, then by priority ascending.
fn get_ordered_providers(config: &IntelligenceConfig) -> Vec<ProviderConfig> {
  let mut providers: Vec<ProviderConfig> = config
    .providers
    .iter()
    .filter(|p| p.enabled)
    .cloned()
    .collect();

  let active_id = &config.active_provider_id;
  providers.sort_by(|a, b| {
    let a_active = a.id == *active_id;
    let b_active = b.id == *active_id;
    b_active.cmp(&a_active).then(a.priority.cmp(&b.priority))
  });
  providers
}

// ─── Provider CRUD ───

#[tauri::command]
pub fn save_intelligence_provider(app: AppHandle, provider: ProviderConfig) -> SJMCLResult<()> {
  let binding = app.state::<Mutex<LauncherConfig>>();
  let mut config = binding.lock()?;

  if let Some(existing) = config
    .intelligence
    .providers
    .iter_mut()
    .find(|p| p.id == provider.id)
  {
    *existing = provider;
  } else {
    config.intelligence.providers.push(provider);
  }

  config.save()?;
  Ok(())
}

#[tauri::command]
pub fn delete_intelligence_provider(app: AppHandle, provider_id: String) -> SJMCLResult<()> {
  let binding = app.state::<Mutex<LauncherConfig>>();
  let mut config = binding.lock()?;

  config
    .intelligence
    .providers
    .retain(|p| p.id != provider_id);

  if config.intelligence.active_provider_id == provider_id {
    config.intelligence.active_provider_id = String::new();
  }

  config.save()?;
  Ok(())
}

#[tauri::command]
pub fn set_active_intelligence_provider(app: AppHandle, provider_id: String) -> SJMCLResult<()> {
  let binding = app.state::<Mutex<LauncherConfig>>();
  let mut config = binding.lock()?;

  config.intelligence.active_provider_id = provider_id;
  config.save()?;
  Ok(())
}

// ─── LLM API ───

#[tauri::command]
pub async fn retrieve_llm_models(
  app: AppHandle,
  provider_type: String,
  base_url: String,
  api_key: String,
) -> SJMCLResult<Vec<String>> {
  let provider: LLMProviderType = serde_json::from_value(serde_json::Value::String(provider_type))
    .unwrap_or(LLMProviderType::OpenAiCompatible);

  let config = LLMModelConfig {
    base_url,
    api_key,
    model: String::new(),
  };

  let client = app.state::<reqwest::Client>();
  let response = providers::build_list_models_request(&client, &provider, &config)
    .send()
    .await
    .map_err(|e| {
      log::error!("Error connecting to LLM service: {}", e);
      LLMServiceError::NetworkError
    })?;

  if response.status().is_success() {
    let body = response.text().await.map_err(|e| {
      log::error!("Error reading LLM service response: {}", e);
      LLMServiceError::ApiParseError
    })?;
    providers::parse_models_response(&provider, &body).map_err(|e| e.into())
  } else {
    Err(LLMServiceError::InvalidAPIKey.into())
  }
}

#[tauri::command]
pub async fn fetch_llm_chat_response(
  app: AppHandle,
  messages: Vec<ChatMessage>,
) -> SJMCLResult<String> {
  let client = reqwest::Client::new();

  let ordered_providers = {
    let config_binding = app.state::<Mutex<LauncherConfig>>();
    let config_state = config_binding.lock()?;
    if !config_state.intelligence.enabled {
      return Err(LLMServiceError::NotEnabled.into());
    }
    get_ordered_providers(&config_state.intelligence)
  };

  if ordered_providers.is_empty() {
    return Err(LLMServiceError::NoResponse.into());
  }

  let mut last_error = LLMServiceError::NoResponse;

  for provider in &ordered_providers {
    let model_config = LLMModelConfig::from(provider);

    let response = match providers::build_chat_request(
      &client,
      &provider.provider_type,
      &model_config,
      &provider.parameters,
      messages.clone(),
      false,
    )
    .send()
    .await
    {
      Ok(r) => r,
      Err(e) => {
        log::warn!(
          "Provider '{}' connection failed: {}, trying next",
          provider.name,
          e
        );
        last_error = LLMServiceError::NetworkError;
        continue;
      }
    };

    if !response.status().is_success() {
      log::warn!(
        "Provider '{}' returned status {}, trying next",
        provider.name,
        response.status()
      );
      last_error = LLMServiceError::NetworkError;
      continue;
    }

    let body = match response.text().await {
      Ok(b) => b,
      Err(e) => {
        log::warn!(
          "Provider '{}' response read error: {}, trying next",
          provider.name,
          e
        );
        last_error = LLMServiceError::ApiParseError;
        continue;
      }
    };

    return providers::parse_chat_response(&provider.provider_type, &body).map_err(|e| e.into());
  }

  Err(last_error.into())
}

#[tauri::command]
pub async fn fetch_llm_chat_response_stream(
  app: AppHandle,
  messages: Vec<ChatMessage>,
  on_event: Channel<String>,
) -> SJMCLResult<()> {
  let client = reqwest::Client::new();

  let ordered_providers = {
    let config_binding = app.state::<Mutex<LauncherConfig>>();
    let config_state = config_binding.lock()?;
    if !config_state.intelligence.enabled {
      return Err(LLMServiceError::NotEnabled.into());
    }
    get_ordered_providers(&config_state.intelligence)
  };

  if ordered_providers.is_empty() {
    return Err(LLMServiceError::NoResponse.into());
  }

  let mut last_error = LLMServiceError::NoResponse;

  for provider in &ordered_providers {
    let model_config = LLMModelConfig::from(provider);

    let response = match providers::build_chat_request(
      &client,
      &provider.provider_type,
      &model_config,
      &provider.parameters,
      messages.clone(),
      true,
    )
    .send()
    .await
    {
      Ok(r) => r,
      Err(e) => {
        log::warn!(
          "Provider '{}' connection failed: {}, trying next",
          provider.name,
          e
        );
        last_error = LLMServiceError::NetworkError;
        continue;
      }
    };

    if !response.status().is_success() {
      log::warn!(
        "Provider '{}' returned status {}, trying next",
        provider.name,
        response.status()
      );
      last_error = LLMServiceError::NetworkError;
      continue;
    }

    // Connection succeeded — stream from this provider (no mid-stream failover)
    let mut response = response;
    let mut buffer = String::new();

    while let Ok(Some(chunk)) = response.chunk().await {
      let s = String::from_utf8_lossy(&chunk);
      buffer.push_str(&s);

      while let Some(i) = buffer.find("\n\n") {
        let block = buffer[..i].to_string();
        buffer = buffer[i + 2..].to_string();

        if let Some(data) = providers::extract_sse_data(&block) {
          match providers::parse_stream_event(&provider.provider_type, &data) {
            StreamParseResult::Content(text) => {
              let _ = on_event.send(text);
            }
            StreamParseResult::Done => return Ok(()),
            StreamParseResult::Skip => continue,
            StreamParseResult::Error(e) => return Err(e.into()),
          }
        }
      }
    }

    return Ok(());
  }

  Err(last_error.into())
}

// ─── Chat Session Management ───

#[tauri::command]
pub fn retrieve_chat_sessions(app: AppHandle) -> SJMCLResult<Vec<ChatSessionSummary>> {
  let binding = app.state::<Mutex<ChatHistory>>();
  let history = binding.lock()?;
  let mut summaries: Vec<ChatSessionSummary> = history
    .sessions
    .iter()
    .map(ChatSessionSummary::from)
    .collect();
  summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
  Ok(summaries)
}

#[tauri::command]
pub fn retrieve_chat_session(app: AppHandle, session_id: String) -> SJMCLResult<ChatSession> {
  let binding = app.state::<Mutex<ChatHistory>>();
  let history = binding.lock()?;
  history
    .sessions
    .iter()
    .find(|s| s.id == session_id)
    .cloned()
    .ok_or_else(|| crate::error::SJMCLError("Session not found".to_string()))
}

#[tauri::command]
pub fn save_chat_session(app: AppHandle, session: ChatSession) -> SJMCLResult<()> {
  let binding = app.state::<Mutex<ChatHistory>>();
  let mut history = binding.lock()?;
  if let Some(existing) = history.sessions.iter_mut().find(|s| s.id == session.id) {
    *existing = session;
  } else {
    history.sessions.push(session);
  }
  history.save()?;
  Ok(())
}

#[tauri::command]
pub fn delete_chat_session(app: AppHandle, session_id: String) -> SJMCLResult<()> {
  let binding = app.state::<Mutex<ChatHistory>>();
  let mut history = binding.lock()?;
  history.sessions.retain(|s| s.id != session_id);
  history.save()?;
  Ok(())
}
