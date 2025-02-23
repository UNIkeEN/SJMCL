use crate::error::{SJMCLError, SJMCLResult};
use quartz_nbt::{io::read_nbt, io::Flavor, NbtCompound};
use std::{
  fs::File,
  io::{Cursor, Read},
  path::PathBuf,
};

pub fn load_nbt(nbt_path: &PathBuf, compress_method: Flavor) -> SJMCLResult<NbtCompound> {
  match File::open(nbt_path) {
    Ok(mut nbt_file) => {
      let mut nbt_bytes = Vec::new();
      if let Err(e) = nbt_file.read_to_end(&mut nbt_bytes) {
        return Err(SJMCLError::from(e));
      }
      match read_nbt(&mut Cursor::new(nbt_bytes), compress_method) {
        Ok(nbt) => Ok(nbt.0),
        Err(e) => Err(SJMCLError::from(e)),
      }
    }
    Err(e) => Err(SJMCLError::from(e)),
  }
}
