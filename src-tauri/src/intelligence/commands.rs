use std::sync::Mutex;

use tauri::{ipc::Channel, AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::error::SJMCLResult;
use crate::intelligence::models::{
  ChatCompletionChunk, ChatCompletionRequest, ChatCompletionResponse, ChatHistory, ChatMessage,
  ChatModelsResponse, ChatSession, ChatSessionSummary, LLMServiceError,
};
use crate::launcher_config::models::LauncherConfig;
use crate::storage::Storage;

// TODO: make chat completion as helper funtion
// TODO: migrate log analysis logic to backend (w multi-language prompt and result parsing)

#[tauri::command]
pub async fn retrieve_llm_models(
  app: AppHandle,
  base_url: String,
  api_key: String,
) -> SJMCLResult<Vec<String>> {
  let client = app.state::<reqwest::Client>();
  let response = client
    .get(format!("{}/v1/models", base_url))
    .bearer_auth(api_key)
    .send()
    .await
    .map_err(|e| {
      log::error!("Error connecting to LLM service: {}", e);
      LLMServiceError::NetworkError
    })?;

  if response.status().is_success() {
    let models_response = response.json::<ChatModelsResponse>().await.map_err(|e| {
      log::error!("Error parsing LLM service response: {}", e);
      LLMServiceError::ApiParseError
    })?;
    Ok(models_response.data.iter().map(|m| m.id.clone()).collect())
  } else {
    Err(LLMServiceError::InvalidAPIKey.into())
  }
}

#[tauri::command]
pub async fn fetch_llm_chat_response(
  app: AppHandle,
  messages: Vec<ChatMessage>,
) -> SJMCLResult<String> {
  let client = reqwest::Client::new(); // use a separate client instance w/o timeout.

  let (enabled, model_config) = {
    let config_binding = app.state::<Mutex<LauncherConfig>>();
    let config_state = config_binding.lock()?;
    (
      config_state.intelligence.enabled,
      config_state.intelligence.model.clone(),
    )
  };

  if !enabled {
    return Err(LLMServiceError::NotEnabled.into());
  }

  let response = client
    .post(format!("{}/v1/chat/completions", model_config.base_url))
    .bearer_auth(&model_config.api_key)
    .json(&ChatCompletionRequest {
      model: model_config.model.clone(),
      messages,
      stream: false,
    })
    .send()
    .await
    .map_err(|e| {
      log::error!("Error connecting to AI service: {}", e);
      LLMServiceError::NetworkError
    })?;

  if response.status().is_success() {
    let completion_response = response
      .json::<ChatCompletionResponse>()
      .await
      .map_err(|e| {
        log::error!("Error parsing AI service response: {}", e);
        LLMServiceError::ApiParseError
      })?;
    if let Some(choice) = completion_response.choices.first() {
      Ok(choice.message.content.clone())
    } else {
      Err(LLMServiceError::NoResponse.into())
    }
  } else {
    log::error!("AI service returned error status: {}", response.status());
    Err(LLMServiceError::NetworkError.into())
  }
}

#[tauri::command]
pub async fn fetch_llm_chat_response_stream(
  app: AppHandle,
  messages: Vec<ChatMessage>,
  on_event: Channel<String>,
) -> SJMCLResult<()> {
  let client = reqwest::Client::new();

  let (enabled, model_config) = {
    let config_binding = app.state::<Mutex<LauncherConfig>>();
    let config_state = config_binding.lock()?;
    (
      config_state.intelligence.enabled,
      config_state.intelligence.model.clone(),
    )
  };

  if !enabled {
    return Err(LLMServiceError::NotEnabled.into());
  }

  let mut response = client
    .post(format!("{}/v1/chat/completions", model_config.base_url))
    .bearer_auth(&model_config.api_key)
    .json(&ChatCompletionRequest {
      model: model_config.model.clone(),
      messages,
      stream: true,
    })
    .send()
    .await
    .map_err(|e| {
      log::error!("Error connecting to AI service: {}", e);
      LLMServiceError::NetworkError
    })?;

  if !response.status().is_success() {
    log::error!("AI service returned error status: {}", response.status());
    return Err(LLMServiceError::NetworkError.into());
  }

  let mut buffer = String::new();

  while let Ok(Some(chunk)) = response.chunk().await {
    let s = String::from_utf8_lossy(&chunk);
    buffer.push_str(&s);

    while let Some(i) = buffer.find("\n\n") {
      let line = buffer[..i].to_string();
      buffer = buffer[i + 2..].to_string();

      if line.starts_with("data: ") {
        let data = &line["data: ".len()..].trim();
        if *data == "[DONE]" {
          break;
        }
        if let Ok(chunk_resp) = serde_json::from_str::<ChatCompletionChunk>(data) {
          if let Some(choice) = chunk_resp.choices.first() {
            if let Some(content) = &choice.delta.content {
              let _ = on_event.send(content.clone());
            }
          }
        }
      }
    }
  }

  Ok(())
}

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
