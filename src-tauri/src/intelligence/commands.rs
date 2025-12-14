use std::sync::Mutex;

use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::error::SJMCLResult;
use crate::intelligence::models::{
  ChatCompletionRequest, ChatCompletionResponse, ChatMessage, ChatModelsResponse, LLMServiceError,
};
use crate::launcher_config::models::LauncherConfig;

// TODO: make chat completion as helper funtion
// TODO: migrate log analysis logic to backend (w multi-language prompt and result parsing)

#[tauri::command]
pub async fn check_llm_service_availability(
  app: AppHandle,
  base_url: String,
  api_key: String,
  model: String,
) -> SJMCLResult<()> {
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
    if models_response.data.iter().any(|m| m.id == model) {
      Ok(())
    } else {
      Err(LLMServiceError::NoSuchModel.into())
    }
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
