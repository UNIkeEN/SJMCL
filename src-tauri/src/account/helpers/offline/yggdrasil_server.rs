use crate::account::models::{PlayerInfo, SkinModel};
use crate::error::SJMCLResult;
use crate::utils::image::ImageWrapper;
use crate::utils::sys_info::find_free_port;
use axum::{
  extract::{Path, Query, State},
  http::{HeaderMap, StatusCode},
  response::IntoResponse,
  routing::{get, post},
  Json, Router,
};
use base64::{engine::general_purpose, Engine};
use image::{ImageFormat, RgbaImage};
use rsa::{
  pkcs1v15::SigningKey,
  pkcs8::EncodePublicKey,
  rand_core,
  signature::{SignatureEncoding, Signer},
  RsaPrivateKey, RsaPublicKey,
};
use serde_json::{json, Map, Value};
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::{
  collections::HashMap,
  io::Cursor,
  net::SocketAddr,
  str::FromStr,
  sync::{Arc, Mutex},
};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

lazy_static::lazy_static! {
  static ref KEY_PAIR: (RsaPrivateKey, RsaPublicKey) = generate_key_pair();
}

fn generate_key_pair() -> (RsaPrivateKey, RsaPublicKey) {
  let mut rng = rand_core::OsRng;
  let bits = 4096;
  let private_key = RsaPrivateKey::new(&mut rng, bits).expect("Failed to generate private key");
  let public_key = RsaPublicKey::from(&private_key);
  (private_key, public_key)
}

pub fn get_public_key() -> String {
  KEY_PAIR
    .1
    .to_public_key_pem(rsa::pkcs8::LineEnding::LF)
    .expect("Failed to encode public key")
    .to_string()
}

fn sign_data(data: &str) -> String {
  let signing_key = SigningKey::<Sha1>::new_unprefixed(KEY_PAIR.0.clone());
  let signature = signing_key.sign(data.as_bytes());
  general_purpose::STANDARD.encode(signature.to_bytes())
}

impl ImageWrapper {
  pub fn compute_hash(&self) -> String {
    let mut hasher = Sha256::new();
    hasher.update(self.image.as_raw());
    let result = hasher.finalize();
    hex::encode(result)
  }
}

impl PlayerInfo {
  pub fn to_simple_response(&self) -> Value {
    json!({
      "id": self.uuid.as_simple(),
      "name": self.name
    })
  }

  pub fn to_full_response(&self, root_url: &str) -> Value {
    let mut textures = Map::new();

    for texture in &self.textures {
      let mut texture_obj = json!({
        "url": format!("{}/textures/{}", root_url, texture.image.compute_hash()),
      });
      if texture.model == SkinModel::Slim {
        texture_obj["metadata"] = json!({
          "model": texture.model.to_string()
        });
      }
      textures.insert(texture.texture_type.to_string(), texture_obj);
    }

    let texture_response = json!({
      "timestamp": chrono::Local::now().timestamp_millis(),
      "profileId": self.uuid.as_simple(),
      "profileName": self.name,
      "textures": textures
    });

    let textures_json = serde_json::to_string(&texture_response).unwrap();
    let textures_encoded = general_purpose::STANDARD.encode(textures_json.as_bytes());
    let signature = sign_data(&textures_encoded);

    json!({
      "id": self.uuid.as_simple(),
      "name": self.name,
      "properties": [
        {
          "name": "textures",
          "value": textures_encoded,
          "signature": signature
        }
      ]
    })
  }
}

#[derive(Clone)]
pub struct YggdrasilServer {
  pub root_url: String,
  pub port: u16,
  pub metadata: Value,
  pub players: Arc<Mutex<Vec<PlayerInfo>>>,
}

impl YggdrasilServer {
  pub fn new() -> Self {
    let port = find_free_port(Some(18960)).unwrap(); // 饮水思源，爱国荣校
    let public_key = get_public_key();

    Self {
      root_url: format!("http://localhost:{}", port),
      port,
      metadata: json!({
        "signaturePublickey": public_key,
        "skinDomains": ["127.0.0.1", "localhost"],
        "meta": {
          "serverName": "SJMCL",
          "implementationName": "SJMCL",
          "implementationVersion": "1.0",
          "feature.non_email_login": true
        }
      }),
      players: Arc::new(Mutex::new(vec![])),
    }
  }

  pub async fn run(self) -> SJMCLResult<()> {
    let app = self.clone().create_router();
    let addr = SocketAddr::from_str(&format!("127.0.0.1:{}", self.port))?;

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    log::info!("Local Yggdrasil server listening on {}", addr);

    axum::serve(listener, app).await?;
    Ok(())
  }

  fn create_router(self) -> Router {
    let server_state = self.clone();

    Router::new()
      .route("/", get(handle_root))
      .route("/status", get(handle_status))
      .route("/api/profiles/minecraft", post(handle_profiles))
      .route(
        "/sessionserver/session/minecraft/hasJoined",
        get(handle_has_joined),
      )
      .route(
        "/sessionserver/session/minecraft/join",
        post(handle_join_server),
      )
      .route(
        "/sessionserver/session/minecraft/profile/{uuid}",
        get(handle_profile_route),
      )
      .route("/textures/{hash}", get(handle_texture_route))
      .layer(CorsLayer::permissive())
      .with_state(server_state)
  }

  pub fn find_player_by_name(&self, username: &str) -> Option<PlayerInfo> {
    self
      .players
      .lock()
      .unwrap()
      .iter()
      .find(|player| player.name == username)
      .cloned()
  }

  pub fn find_player_by_uuid(&self, uuid: Uuid) -> Option<PlayerInfo> {
    self
      .players
      .lock()
      .unwrap()
      .iter()
      .find(|player| player.uuid == uuid)
      .cloned()
  }

  pub fn find_texture_by_hash(&self, hash: &str) -> Option<RgbaImage> {
    let players = self.players.lock().unwrap();
    for player in players.iter() {
      for texture in &player.textures {
        let texture_hash = texture.image.compute_hash();
        if texture_hash == hash {
          return Some(texture.image.image.clone());
        }
      }
    }
    None
  }

  pub fn apply_player(&self, player: PlayerInfo) {
    let mut players = self.players.lock().unwrap();
    for p in players.iter_mut() {
      if p.uuid == player.uuid {
        *p = player;
        return;
      }
    }
    players.push(player);
  }
}

async fn handle_root(State(state): State<YggdrasilServer>) -> Json<Value> {
  log::info!("Local Yggdrasil server received: GET /");

  Json(state.metadata.clone())
}

async fn handle_status(State(state): State<YggdrasilServer>) -> Json<Value> {
  let players = state.players.lock().unwrap();

  log::info!(
    "Local Yggdrasil server received: GET /status - Status endpoint (chars: {})",
    players.len()
  );

  Json(json!({
    "user.count": players.len(),
    "token.count": 0,
    "pendingAuthentication.count": 0
  }))
}

async fn handle_profiles(
  State(state): State<YggdrasilServer>,
  Json(names): Json<Vec<String>>,
) -> Json<Vec<Value>> {
  let mut results = Vec::new();

  for name in names.iter() {
    if let Some(player) = state.find_player_by_name(name) {
      results.push(player.to_simple_response());
    }
  }

  log::info!(
    "Local Yggdrasil server received: POST /api/profiles/minecraft - Profiles: {} requested, {} found",
    names.len(),
    results.len()
  );

  Json(results)
}

async fn handle_has_joined(
  State(state): State<YggdrasilServer>,
  Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
  match params.get("username") {
    Some(username) => {
      log::info!(
        "Local Yggdrasil server received: GET /sessionserver/session/minecraft/hasJoined - username: {}",
        username
      );
      if let Some(player) = state.find_player_by_name(username) {
        (
          StatusCode::OK,
          Json(player.to_full_response(&state.root_url)),
        )
          .into_response()
      } else {
        log::warn!("Character not found: {}", username);
        StatusCode::NO_CONTENT.into_response()
      }
    }
    None => {
      log::warn!("Missing username parameter");
      StatusCode::BAD_REQUEST.into_response()
    }
  }
}

async fn handle_join_server(
  State(_state): State<YggdrasilServer>,
  Json(_body): Json<Value>,
) -> StatusCode {
  log::info!("Local Yggdrasil server received: POST /sessionserver/session/minecraft/join");
  StatusCode::NO_CONTENT
}

async fn handle_profile_route(
  State(state): State<YggdrasilServer>,
  Path(uuid): Path<String>,
) -> impl IntoResponse {
  log::info!(
    "Local Yggdrasil server received: GET /sessionserver/session/minecraft/profile/{}",
    uuid
  );
  if let Ok(parsed_uuid) = Uuid::parse_str(&uuid) {
    if let Some(player) = state.find_player_by_uuid(parsed_uuid) {
      return (
        StatusCode::OK,
        Json(player.to_full_response(&state.root_url)),
      )
        .into_response();
    }
  }
  log::warn!("Profile not found: {}", uuid);
  StatusCode::NO_CONTENT.into_response()
}

async fn handle_texture_route(
  State(state): State<YggdrasilServer>,
  Path(hash): Path<String>,
) -> impl IntoResponse {
  log::info!("Local Yggdrasil server received: GET /textures/{}", hash);

  if let Some(image) = state.find_texture_by_hash(&hash) {
    let mut buf = Vec::new();
    image
      .write_to(&mut Cursor::new(&mut buf), ImageFormat::Png)
      .unwrap();
    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", "image/png".parse().unwrap());
    headers.insert("Etag", format!("\"{}\"", hash).parse().unwrap());
    headers.insert("Cache-Control", "max-age=2592000, public".parse().unwrap());

    (StatusCode::OK, headers, buf).into_response()
  } else {
    log::warn!("Texture not found: {}", hash);
    StatusCode::NOT_FOUND.into_response()
  }
}
