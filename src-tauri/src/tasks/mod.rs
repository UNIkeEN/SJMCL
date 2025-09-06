pub mod background;
pub mod commands;
pub mod download;
pub mod events;
pub mod monitor;
pub mod reporter;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RuntimeTaskParam {
  Download(download::DownloadParam),
}
