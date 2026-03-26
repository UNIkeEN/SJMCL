use crate::storage::Storage;
use crate::{APP_DATA_DIR, EXE_DIR, IS_PORTABLE};
use serde::{Deserialize, Serialize};
use smart_default::SmartDefault;
use std::path::PathBuf;
use strum_macros::Display;

structstruck::strike! {
  #[strikethrough[derive(Serialize, Deserialize)]]
  pub struct ChatModelsResponse {
    pub data: Vec<pub struct ChatModel {
      pub id: String,
      pub object: String,
      pub owned_by: String,
    }>,
  }
}

structstruck::strike! {
  #[strikethrough[derive(Debug, Clone, Serialize, Deserialize)]]
  pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<pub struct ChatMessage {
      pub role: String,
      pub content: String,
    }>,
    pub stream: bool,
  }
}

structstruck::strike! {
  #[strikethrough[derive(Serialize, Deserialize)]]
  pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub choices: Vec<pub struct ChatCompletionChoice {
      pub index: u32,
      pub message: ChatMessage,
      pub finish_reason: String,
    }>,
  }
}

structstruck::strike! {
  #[strikethrough[derive(Serialize, Deserialize, Debug)]]
  pub struct ChatCompletionChunk {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub choices: Vec<pub struct ChatCompletionChunkChoice {
      pub index: u32,
      pub delta: pub struct ChatMessageDelta {
        pub role: Option<String>,
        pub content: Option<String>,
      },
      pub finish_reason: Option<String>,
    }>,
  }
}

// ── Anthropic types ──

#[derive(Debug, Serialize)]
pub struct AnthropicRequest {
  pub model: String,
  pub messages: Vec<ChatMessage>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub system: Option<String>,
  pub max_tokens: u32,
  pub stream: bool,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub temperature: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub top_p: Option<f64>,
}

structstruck::strike! {
  #[strikethrough[derive(Deserialize, Debug)]]
  pub struct AnthropicResponse {
    pub content: Vec<pub struct AnthropicContentBlock {
      #[serde(rename = "type")]
      pub block_type: String,
      #[serde(default)]
      pub text: String,
    }>,
    pub stop_reason: Option<String>,
  }
}

structstruck::strike! {
  #[strikethrough[derive(Deserialize, Debug)]]
  pub struct AnthropicStreamEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    #[serde(default)]
    pub delta: Option<pub struct AnthropicDelta {
      #[serde(rename = "type")]
      pub delta_type: Option<String>,
      pub text: Option<String>,
    }>,
  }
}

structstruck::strike! {
  #[strikethrough[derive(Deserialize, Debug)]]
  pub struct AnthropicModelsResponse {
    pub data: Vec<pub struct AnthropicModel {
      pub id: String,
    }>,
  }
}

// ── Gemini types ──

structstruck::strike! {
  #[strikethrough[derive(Serialize, Deserialize, Debug, Clone)]]
  pub struct GeminiContent {
    pub role: String,
    pub parts: Vec<pub struct GeminiPart {
      pub text: String,
    }>,
  }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiRequest {
  pub contents: Vec<GeminiContent>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub system_instruction: Option<GeminiContent>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub generation_config: Option<GeminiGenerationConfig>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiGenerationConfig {
  #[serde(skip_serializing_if = "Option::is_none")]
  pub temperature: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub max_output_tokens: Option<u32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub top_p: Option<f64>,
}

structstruck::strike! {
  #[strikethrough[derive(Deserialize, Debug)]]
  pub struct GeminiResponse {
    #[serde(default)]
    pub candidates: Vec<pub struct GeminiCandidate {
      pub content: GeminiContent,
    }>,
  }
}

structstruck::strike! {
  #[strikethrough[derive(Deserialize, Debug)]]
  pub struct GeminiModelsResponse {
    pub models: Vec<pub struct GeminiModel {
      pub name: String,
      #[serde(default)]
      pub display_name: Option<String>,
    }>,
  }
}

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum LLMServiceError {
  ApiParseError,
  InvalidAPIKey,
  NetworkError,
  NotEnabled,
  NoResponse,
}

impl std::error::Error for LLMServiceError {}

const CHAT_HISTORY_FILE_NAME: &str = "chat_history.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatSession {
  pub id: String,
  pub title: String,
  pub messages: Vec<ChatMessage>,
  pub created_at: u64,
  pub updated_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatSessionSummary {
  pub id: String,
  pub title: String,
  pub created_at: u64,
  pub updated_at: u64,
}

impl From<&ChatSession> for ChatSessionSummary {
  fn from(session: &ChatSession) -> Self {
    ChatSessionSummary {
      id: session.id.clone(),
      title: session.title.clone(),
      created_at: session.created_at,
      updated_at: session.updated_at,
    }
  }
}

#[derive(Debug, Serialize, Deserialize, Clone, SmartDefault)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistory {
  #[default(_code = "vec![]")]
  pub sessions: Vec<ChatSession>,
}

impl Storage for ChatHistory {
  fn file_path() -> PathBuf {
    if *IS_PORTABLE {
      EXE_DIR.join(CHAT_HISTORY_FILE_NAME)
    } else {
      APP_DATA_DIR.get().unwrap().join(CHAT_HISTORY_FILE_NAME)
    }
  }
}
