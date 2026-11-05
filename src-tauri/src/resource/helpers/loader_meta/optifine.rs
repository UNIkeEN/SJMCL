use std::ffi::OsStr;

use sjmcl_types::error::SJMCLResult;
use tauri_plugin_http::reqwest::Client;

use crate::{
  resource::{
    helpers::misc::get_download_api,
    models::{OptiFineResourceInfo, ResourceError, ResourceType, SourceType},
  },
  utils::fs::split_filename,
};

pub struct OptiFineMetaClient {
  http: Client,
}

impl OptiFineMetaClient {
  pub fn new(http: Client) -> Self {
    Self { http }
  }

  pub async fn fetch(
    &self,
    priority_list: &[SourceType],
    game_version: &str,
  ) -> SJMCLResult<Vec<OptiFineResourceInfo>> {
    for source_type in priority_list.iter() {
      match source_type {
        SourceType::BMCLAPIMirror => {
          return self.fetch_from_bmcl(game_version).await;
        }
        _ => continue,
      }
    }
    Err(ResourceError::NetworkError.into())
  }

  async fn fetch_from_bmcl(&self, game_version: &str) -> SJMCLResult<Vec<OptiFineResourceInfo>> {
    let url =
      get_download_api(SourceType::BMCLAPIMirror, ResourceType::OptiFine)?.join(game_version)?;
    match self.http.get(url).send().await {
      Ok(response) => {
        if response.status().is_success() {
          let mut manifest = response
            .json::<Vec<OptiFineResourceInfo>>()
            .await
            .map_err(|_| ResourceError::ParseError)?;

          manifest.iter_mut().for_each(|info| {
            info.filename = split_filename(OsStr::new(&info.filename)).0;
          });
          manifest.sort_by(|a, b| {
            Self::build_sort_key(b)
              .cmp(&Self::build_sort_key(a))
              .then_with(|| b.filename.cmp(&a.filename))
          });

          Ok(manifest)
        } else {
          Err(ResourceError::NetworkError.into())
        }
      }
      Err(_) => Err(ResourceError::NetworkError.into()),
    }
  }

  fn build_sort_key(info: &OptiFineResourceInfo) -> (u32, u32, u32) {
    let Some((_, suffix)) = info.filename.rsplit_once("_HD_U_") else {
      return (0, 0, 0);
    };
    let (version, pre) = match suffix.split_once("_pre") {
      Some((version, pre)) => (version, pre.parse().unwrap_or(0)),
      None => (suffix, u32::MAX),
    };
    let mut chars = version.chars();
    let prefix = chars
      .next()
      .map(|ch| ch.to_ascii_uppercase() as u32)
      .unwrap_or(0);
    let series = chars.as_str().parse().unwrap_or(0);
    (prefix, series, pre)
  }
}
