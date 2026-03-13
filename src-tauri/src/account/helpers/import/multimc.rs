use crate::account::helpers::import::misc::{list_launcher_candidate_dirs, ACCESS_TOKEN_EXPIRED};
use crate::account::helpers::microsoft::oauth::fetch_minecraft_profile;
use crate::account::helpers::misc::fetch_image;
use crate::account::helpers::offline::load_preset_skin;
use crate::account::models::{
  AccountError, PlayerInfo, PlayerType, PresetRole, SkinModel, Texture, TextureType,
};
use crate::error::SJMCLResult;
use serde::Deserialize;
use std::collections::HashSet;
use std::fs;
use std::str::FromStr;
use tauri::AppHandle;
use url::Url;
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
pub struct MultiMCMsa {
  pub exp: i64,
  pub refresh_token: String,
  pub token: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MultiMCProfile {
  pub id: String,
  pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MultiMCYgg {
  pub token: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MultiMCOfficialAccount {
  pub active: bool,
  pub r#type: String,
  pub msa: MultiMCMsa,
  pub profile: MultiMCProfile,
  pub ygg: MultiMCYgg,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiMCAccountEntry {
  pub accounts: Vec<MultiMCOfficialAccount>,
  pub format_version: u32,
}

async fn microsoft_to_player(
  app: &AppHandle,
  acc: &MultiMCOfficialAccount,
) -> SJMCLResult<PlayerInfo> {
  let profile_result = fetch_minecraft_profile(app, acc.ygg.token.clone()).await;
  let profile = match profile_result {
    Ok(p) => p,
    Err(_) => {
      return Ok(
        PlayerInfo {
          id: "".to_string(),
          uuid: Uuid::from_str(&acc.profile.id).map_err(|_| AccountError::ParseError)?,
          name: acc.profile.name.clone(),
          player_type: PlayerType::Microsoft,
          auth_account: None,
          access_token: Some(ACCESS_TOKEN_EXPIRED.to_string()),
          refresh_token: Some(acc.msa.refresh_token.clone()),
          textures: load_preset_skin(app, PresetRole::Steve)?,
          auth_server_url: None,
        }
        .with_generated_id(),
      );
    }
  };

  let mut textures = vec![];
  if let Some(skins) = &profile.skins {
    for skin in skins {
      if skin.state == "ACTIVE" {
        textures.push(Texture {
          texture_type: TextureType::Skin,
          image: fetch_image(app, skin.url.clone()).await?,
          model: skin.variant.clone().unwrap_or_default(),
          preset: None,
        });
      }
    }
  }
  if let Some(capes) = &profile.capes {
    for cape in capes {
      if cape.state == "ACTIVE" {
        textures.push(Texture {
          texture_type: TextureType::Cape,
          image: fetch_image(app, cape.url.clone()).await?,
          model: SkinModel::Default,
          preset: None,
        });
      }
    }
  }

  if textures.is_empty() {
    // this player didn't have a texture, use preset Steve skin instead
    textures = load_preset_skin(app, PresetRole::Steve)?;
  }

  Ok(
    PlayerInfo {
      id: "".to_string(),
      uuid: Uuid::from_str(&profile.id).map_err(|_| AccountError::ParseError)?,
      name: profile.name.clone(),
      player_type: PlayerType::Microsoft,
      auth_account: Some(profile.name.clone()),
      access_token: Some(acc.msa.token.clone()),
      refresh_token: Some(acc.msa.refresh_token.clone()),
      textures,
      auth_server_url: None,
    }
    .with_generated_id(),
  )
}

pub async fn retrieve_multimc_account_info(
  app: &AppHandle,
) -> SJMCLResult<(Vec<PlayerInfo>, Vec<Url>)> {
  let candidate_dirs = list_launcher_candidate_dirs(app);
  let multimc_json_paths: Vec<_> = candidate_dirs
    .into_iter()
    .map(|dir| dir.join("accounts.json"))
    .filter(|path| path.is_file())
    .collect();
  let multimc_jsons = multimc_json_paths
    .into_iter()
    .filter_map(|path| fs::read_to_string(path).ok())
    .filter_map(|content| serde_json::from_str::<MultiMCAccountEntry>(content.as_str()).ok())
    .collect::<Vec<_>>();
  let mut player_infos: Vec<PlayerInfo> = Vec::new();
  let mut seen_ids: HashSet<String> = HashSet::new();
  for json in &multimc_jsons {
    for acc in &json.accounts {
      if !seen_ids.insert(acc.profile.id.clone()) {
        continue;
      }
      let player_info = microsoft_to_player(app, acc).await?;
      player_infos.push(player_info);
    }
  }

  Ok((player_infos, vec![]))
}
