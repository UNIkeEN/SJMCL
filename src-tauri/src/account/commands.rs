use super::models::{Player, PlayerInfo};
use crate::{
  auth_server::models::AuthServer,
  error::{SJMCLError, SJMCLResult},
  storage::Storage,
};
use uuid::Uuid;

#[tauri::command]
pub fn get_players() -> SJMCLResult<Vec<Player>> {
  let state: Vec<PlayerInfo> = Storage::load().unwrap_or_default();
  let auth_servers: Vec<AuthServer> = Storage::load().unwrap_or_default();
  let players: Vec<Player> = state
    .into_iter()
    .map(|player_info| {
      let auth_server = auth_servers
        .iter()
        .find(|server| server.auth_url == player_info.auth_server_url)
        .cloned()
        .unwrap_or_default();
      Player {
        uuid: player_info.uuid,
        name: player_info.name,
        player_type: player_info.player_type,
        auth_server,
        avatar_src: player_info.avatar_src,
        auth_account: player_info.auth_account,
        password: player_info.password,
      }
    })
    .collect();
  Ok(players)
}

#[tauri::command]
pub async fn add_player(mut player: PlayerInfo) -> SJMCLResult<()> {
  let uuid = Uuid::new_v4();
  match player.player_type.as_str() {
    "offline" => {
      let mut state: Vec<PlayerInfo> = Storage::load().unwrap_or_default();

      player.uuid = uuid.to_string();
      player.avatar_src = "https://littleskin.cn/avatar/0?size=72&png=1".to_string();

      state.push(player);
      state.save()?;
      Ok(())
    }
    "3rdparty" => {
      let mut state: Vec<PlayerInfo> = Storage::load().unwrap_or_default();

      // todo: real login
      player.name = "Player".to_string();
      player.uuid = uuid.to_string();
      player.avatar_src = "https://littleskin.cn/avatar/0?size=72&png=1".to_string();

      state.push(player);
      state.save()?;
      Ok(())
    }
    _ => Err(SJMCLError("Unknown server type".to_string())),
  }
}

#[tauri::command]
pub fn delete_player(uuid: String) -> SJMCLResult<()> {
  let mut state: Vec<PlayerInfo> = Storage::load().unwrap_or_default();

  state.retain(|s| s.uuid != uuid);
  state.save()?;
  Ok(())
}
