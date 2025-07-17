use tokio_util::bytes::Bytes;

pub trait Unit {
  fn unit_size(&self) -> i64;
}

impl<T> Unit for &T {
  fn unit_size(&self) -> i64 {
    1
  }
}

impl Unit for Bytes {
  fn unit_size(&self) -> i64 {
    self.len() as i64
  }
}

impl<T, E> Unit for Result<T, E>
where
  T: Unit,
{
  fn unit_size(&self) -> i64 {
    match self {
      Ok(b) => (*b).unit_size(),
      Err(_) => 0,
    }
  }
}

impl<T> Unit for Option<T>
where
  T: Unit,
{
  fn unit_size(&self) -> i64 {
    match self {
      Some(b) => (*b).unit_size(),
      None => 0,
    }
  }
}
