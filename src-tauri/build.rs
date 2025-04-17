use dotenvy::{from_filename, dotenv_override};
use std::{env, fs, path::Path};

fn main() {
  if std::env::var("GITHUB_ACTIONS").is_err() {
    // Load env variables from ".env" file, if not exists, use ".env.template" to set default value.
    from_filename(".env.template").ok();
    dotenv_override().ok(); 
  }

  let out_dir = env::var("OUT_DIR").unwrap_or_else(|_| "".to_string());
  let dest_path = Path::new(&out_dir).join("secrets.rs");
  let _ = fs::remove_file(&dest_path);

  // Iterate over all env variables and write those starting with "SJMCL_" into "secrets.rs" as pub const
  // To use secrets, try "include!(concat!(env!("OUT_DIR"), "/secrets.rs"));"
  let mut extra_envs = String::new();
  for (key, value) in env::vars() {
    if key.starts_with("SJMCL_") {
      extra_envs.push_str(&format!(
        "pub const {}: &str = \"{}\";\n",
        key.replace("-", "_"),
        value
      ));
    }
  }
  fs::write(&dest_path, extra_envs).expect("Failed to write secrets.rs");

  // Notify Cargo to auto re-run the build script if .env changes
  println!("cargo::rerun-if-changed=.env");
  println!("cargo::rerun-if-changed=.env.template");

  tauri_build::build()
}
