use tauri_plugin_http::reqwest;

use crate::intelligence::models::{
  AnthropicModelsResponse, AnthropicRequest, AnthropicResponse, AnthropicStreamEvent,
  ChatCompletionChunk, ChatCompletionResponse, ChatMessage, ChatModelsResponse, GeminiContent,
  GeminiGenerationConfig, GeminiModelsResponse, GeminiPart, GeminiRequest, GeminiResponse,
  LLMServiceError,
};
use crate::launcher_config::models::{LLMModelConfig, LLMParametersConfig, LLMProviderType};

const ANTHROPIC_BASE_URL: &str = "https://api.anthropic.com";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const GEMINI_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta";

pub enum StreamParseResult {
  Content(String),
  Done,
  Skip,
  Error(LLMServiceError),
}

// ── Build requests ──

pub fn build_list_models_request(
  client: &reqwest::Client,
  provider_type: &LLMProviderType,
  config: &LLMModelConfig,
) -> reqwest::RequestBuilder {
  match provider_type {
    LLMProviderType::OpenAiCompatible => client
      .get(format!("{}/v1/models", config.base_url))
      .bearer_auth(&config.api_key),
    LLMProviderType::Anthropic => client
      .get(format!("{}/v1/models", ANTHROPIC_BASE_URL))
      .header("x-api-key", &config.api_key)
      .header("anthropic-version", ANTHROPIC_VERSION),
    LLMProviderType::Gemini => {
      client.get(format!("{}/models?key={}", GEMINI_BASE_URL, config.api_key))
    }
  }
}

pub fn build_chat_request(
  client: &reqwest::Client,
  provider_type: &LLMProviderType,
  config: &LLMModelConfig,
  params: &LLMParametersConfig,
  messages: Vec<ChatMessage>,
  stream: bool,
) -> reqwest::RequestBuilder {
  match provider_type {
    LLMProviderType::OpenAiCompatible => {
      let mut body = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "stream": stream,
        "temperature": params.temperature,
        "max_tokens": params.max_tokens,
        "top_p": params.top_p,
      });
      if params.frequency_penalty != 0.0 {
        body["frequency_penalty"] = serde_json::json!(params.frequency_penalty);
      }
      if params.presence_penalty != 0.0 {
        body["presence_penalty"] = serde_json::json!(params.presence_penalty);
      }
      client
        .post(format!("{}/v1/chat/completions", config.base_url))
        .bearer_auth(&config.api_key)
        .json(&body)
    }
    LLMProviderType::Anthropic => {
      // Extract system message from messages array
      let (system, chat_messages): (Option<String>, Vec<ChatMessage>) = {
        let mut system_text = None;
        let mut msgs = Vec::new();
        for msg in messages {
          if msg.role == "system" {
            system_text = Some(msg.content);
          } else {
            msgs.push(msg);
          }
        }
        (system_text, msgs)
      };

      let request = AnthropicRequest {
        model: config.model.clone(),
        messages: chat_messages,
        system,
        max_tokens: params.max_tokens,
        stream,
        temperature: Some(params.temperature),
        top_p: Some(params.top_p),
      };

      client
        .post(format!("{}/v1/messages", ANTHROPIC_BASE_URL))
        .header("x-api-key", &config.api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .json(&request)
    }
    LLMProviderType::Gemini => {
      // Convert messages to Gemini format
      let mut contents = Vec::new();
      let mut system_instruction = None;

      for msg in messages {
        if msg.role == "system" {
          system_instruction = Some(GeminiContent {
            role: "user".to_string(),
            parts: vec![GeminiPart { text: msg.content }],
          });
        } else {
          let role = if msg.role == "assistant" {
            "model"
          } else {
            "user"
          };
          contents.push(GeminiContent {
            role: role.to_string(),
            parts: vec![GeminiPart { text: msg.content }],
          });
        }
      }

      let request = GeminiRequest {
        contents,
        system_instruction,
        generation_config: Some(GeminiGenerationConfig {
          temperature: Some(params.temperature),
          max_output_tokens: Some(params.max_tokens),
          top_p: Some(params.top_p),
        }),
      };

      let action = if stream {
        "streamGenerateContent"
      } else {
        "generateContent"
      };
      let mut url = format!(
        "{}/models/{}:{}?key={}",
        GEMINI_BASE_URL, config.model, action, config.api_key
      );
      if stream {
        url.push_str("&alt=sse");
      }

      client.post(url).json(&request)
    }
  }
}

// ── Parse responses ──

pub fn parse_models_response(
  provider_type: &LLMProviderType,
  body: &str,
) -> Result<Vec<String>, LLMServiceError> {
  match provider_type {
    LLMProviderType::OpenAiCompatible => {
      let resp: ChatModelsResponse = serde_json::from_str(body).map_err(|e| {
        log::error!("Error parsing OpenAI models response: {}", e);
        LLMServiceError::ApiParseError
      })?;
      Ok(resp.data.iter().map(|m| m.id.clone()).collect())
    }
    LLMProviderType::Anthropic => {
      let resp: AnthropicModelsResponse = serde_json::from_str(body).map_err(|e| {
        log::error!("Error parsing Anthropic models response: {}", e);
        LLMServiceError::ApiParseError
      })?;
      Ok(resp.data.iter().map(|m| m.id.clone()).collect())
    }
    LLMProviderType::Gemini => {
      let resp: GeminiModelsResponse = serde_json::from_str(body).map_err(|e| {
        log::error!("Error parsing Gemini models response: {}", e);
        LLMServiceError::ApiParseError
      })?;
      // Gemini model names are like "models/gemini-pro", strip the prefix
      Ok(
        resp
          .models
          .iter()
          .map(|m| {
            m.name
              .strip_prefix("models/")
              .unwrap_or(&m.name)
              .to_string()
          })
          .collect(),
      )
    }
  }
}

pub fn parse_chat_response(
  provider_type: &LLMProviderType,
  body: &str,
) -> Result<String, LLMServiceError> {
  match provider_type {
    LLMProviderType::OpenAiCompatible => {
      let resp: ChatCompletionResponse = serde_json::from_str(body).map_err(|e| {
        log::error!("Error parsing OpenAI chat response: {}", e);
        LLMServiceError::ApiParseError
      })?;
      resp
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .ok_or(LLMServiceError::NoResponse)
    }
    LLMProviderType::Anthropic => {
      let resp: AnthropicResponse = serde_json::from_str(body).map_err(|e| {
        log::error!("Error parsing Anthropic chat response: {}", e);
        LLMServiceError::ApiParseError
      })?;
      let text: String = resp
        .content
        .iter()
        .filter(|b| b.block_type == "text")
        .map(|b| b.text.as_str())
        .collect::<Vec<_>>()
        .join("");
      if text.is_empty() {
        Err(LLMServiceError::NoResponse)
      } else {
        Ok(text)
      }
    }
    LLMProviderType::Gemini => {
      let resp: GeminiResponse = serde_json::from_str(body).map_err(|e| {
        log::error!("Error parsing Gemini chat response: {}", e);
        LLMServiceError::ApiParseError
      })?;
      resp
        .candidates
        .first()
        .and_then(|c| c.content.parts.first())
        .map(|p| p.text.clone())
        .ok_or(LLMServiceError::NoResponse)
    }
  }
}

pub fn parse_stream_event(provider_type: &LLMProviderType, data: &str) -> StreamParseResult {
  match provider_type {
    LLMProviderType::OpenAiCompatible => {
      if data == "[DONE]" {
        return StreamParseResult::Done;
      }
      match serde_json::from_str::<ChatCompletionChunk>(data) {
        Ok(chunk) => {
          if let Some(choice) = chunk.choices.first() {
            if let Some(content) = &choice.delta.content {
              StreamParseResult::Content(content.clone())
            } else {
              StreamParseResult::Skip
            }
          } else {
            StreamParseResult::Skip
          }
        }
        Err(e) => {
          log::error!("Error parsing OpenAI stream chunk: {}", e);
          StreamParseResult::Skip
        }
      }
    }
    LLMProviderType::Anthropic => match serde_json::from_str::<AnthropicStreamEvent>(data) {
      Ok(event) => {
        if event.event_type == "message_stop" {
          return StreamParseResult::Done;
        }
        if event.event_type == "content_block_delta" {
          if let Some(delta) = &event.delta {
            if let Some(text) = &delta.text {
              return StreamParseResult::Content(text.clone());
            }
          }
        }
        StreamParseResult::Skip
      }
      Err(_) => StreamParseResult::Skip,
    },
    LLMProviderType::Gemini => match serde_json::from_str::<GeminiResponse>(data) {
      Ok(resp) => {
        if let Some(candidate) = resp.candidates.first() {
          if let Some(part) = candidate.content.parts.first() {
            return StreamParseResult::Content(part.text.clone());
          }
        }
        StreamParseResult::Skip
      }
      Err(_) => StreamParseResult::Skip,
    },
  }
}

/// Extract the `data:` payload from an SSE block (which may contain `event:` and `data:` lines).
pub fn extract_sse_data(block: &str) -> Option<String> {
  for line in block.lines() {
    let trimmed = line.trim();
    if let Some(data) = trimmed.strip_prefix("data: ") {
      return Some(data.trim().to_string());
    }
    if let Some(data) = trimmed.strip_prefix("data:") {
      return Some(data.trim().to_string());
    }
  }
  None
}
