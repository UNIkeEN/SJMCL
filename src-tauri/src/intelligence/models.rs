use serde::{Deserialize, Serialize};
use strum_macros::Display;

structstruck::strike! {
  #[strikethrough[derive(Serialize, Deserialize)]]
  pub struct ChatModelsResponse {
    pub data: Vec<pub struct ChatModel {
      pub id: String,
      pub object: String,
      pub created: u64,
      pub owned_by: String,
    }>,
  }
}

structstruck::strike! {
  #[strikethrough[derive(Serialize, Deserialize)]]
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

#[derive(Debug, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum LLMServiceError {
  ApiParseError,
  InvalidAPIKey,
  NetworkError,
  NotEnabled,
  NoSuchModel,
  NoResponse,
}

impl std::error::Error for LLMServiceError {}
