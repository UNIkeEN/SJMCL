use std::fs::File;
use std::io;
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::{LazyLock, OnceLock};

pub static EXE_PATH: LazyLock<PathBuf> = LazyLock::new(|| std::env::current_exe().unwrap());

pub static EXE_DIR: LazyLock<PathBuf> = LazyLock::new(|| EXE_PATH.parent().unwrap().to_path_buf());

pub static IS_PORTABLE: LazyLock<bool> = LazyLock::new(|| is_portable().unwrap_or(false));

pub static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn init_app_data_dir(path: PathBuf) {
  APP_DATA_DIR
    .set(path)
    .expect("APP_DATA_DIR initialization failed");
}

fn is_portable() -> Result<bool, io::Error> {
  let exe_path = std::env::current_exe()?;
  let mut file = File::open(&exe_path)?;
  file.seek(SeekFrom::End(-12))?;
  let mut footer = [0u8; 4];
  file.read_exact(&mut footer)?;
  Ok(&footer == b"PORT")
}
