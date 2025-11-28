use std::sync::Mutex;

use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::ai::models::{
  AiError, ChatCompletionRequest, ChatCompletionResponse, ChatMessage, ChatModelsResponse,
};
use crate::error::SJMCLResult;
use crate::launcher_config::models::LauncherConfig;

#[tauri::command]
pub async fn check_ai_service_availability(
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
      log::error!("Error connecting to AI service: {}", e);
      AiError::NetworkError
    })?;

  if response.status().is_success() {
    let models_response = response.json::<ChatModelsResponse>().await.map_err(|e| {
      log::error!("Error parsing AI service response: {}", e);
      AiError::ApiParseError
    })?;
    if models_response.data.iter().any(|m| m.id == model) {
      Ok(())
    } else {
      Err(AiError::NoSuchModel.into())
    }
  } else {
    Err(AiError::InvalidAPIKey.into())
  }
}

#[tauri::command]
pub async fn retrieve_ai_chat_response(
  app: AppHandle,
  messages: Vec<ChatMessage>,
) -> SJMCLResult<String> {
  let client = reqwest::Client::new();
  let ai_chat_config = {
    let config_binding = app.state::<Mutex<LauncherConfig>>();
    let config_state = config_binding.lock()?;
    config_state.ai_chat_config.clone()
  };
  if !ai_chat_config.enabled {
    return Err(AiError::NotEnabled.into());
  }
  let response = client
    .post(format!("{}/v1/chat/completions", ai_chat_config.base_url))
    .bearer_auth(&ai_chat_config.api_key)
    .json(&ChatCompletionRequest {
      model: ai_chat_config.model.clone(),
      messages,
      stream: false,
    })
    .send()
    .await
    .map_err(|e| {
      log::error!("Error connecting to AI service: {}", e);
      AiError::NetworkError
    })?;
  if response.status().is_success() {
    let completion_response = response
      .json::<ChatCompletionResponse>()
      .await
      .map_err(|e| {
        log::error!("Error parsing AI service response: {}", e);
        AiError::ApiParseError
      })?;
    if let Some(choice) = completion_response.choices.first() {
      Ok(choice.message.content.clone())
    } else {
      Err(AiError::NoResponse.into())
    }
  } else {
    log::error!("AI service returned error status: {}", response.status());
    Err(AiError::NetworkError.into())
  }
}
