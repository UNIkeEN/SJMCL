use std::cmp::Ordering;

#[derive(PartialEq, Eq)]
pub enum VersionEdition {
  Alpha,
  Beta,
  Release,
  Snapshot,
}

impl VersionEdition {
  pub fn is_release(&self) -> bool {
    matches!(self, VersionEdition::Release | VersionEdition::Snapshot)
  }
  fn to_u8(&self) -> u8 {
    match self {
      // Self::PreClassic => 10,
      // Self::Classic => 20,
      // Self::Indev => 30,
      Self::Alpha => 40,
      Self::Beta => 50,
      _ => 100,
    }
  }
}

impl PartialOrd for VersionEdition {
  fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
    let self_major = self.to_u8();
    let other_major = other.to_u8();
    if self_major == other_major {
      if self.is_release() {
        return None;
      }
      return Some(Ordering::Equal);
    }
    Some(self_major.cmp(&other_major))
  }
}
