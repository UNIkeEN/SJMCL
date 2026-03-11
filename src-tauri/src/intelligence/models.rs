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
