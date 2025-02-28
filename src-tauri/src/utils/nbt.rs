use crate::error::{SJMCLError, SJMCLResult};
use quartz_nbt::{io::read_nbt, io::Flavor, NbtCompound};
use std::{
  fs::File,
  io::{Cursor, Read},
  path::PathBuf,
};
use tokio;

pub async fn load_nbt(nbt_path: &PathBuf, compress_method: Flavor) -> SJMCLResult<NbtCompound> {
  let nbt_bytes = tokio::fs::read(nbt_path).await?;
  let (compound, _) = read_nbt(&mut Cursor::new(nbt_bytes), compress_method)?;
  Ok(compound)
}
