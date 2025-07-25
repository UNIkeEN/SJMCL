use std::cmp::Ordering;

use crate::resource::models::OtherResourceVersionPack;

fn parse_version(version: &str) -> (Vec<u32>, String) {
  let mut version_numbers = Vec::new();
  let mut suffix = String::new();

  for part in version.split('.') {
    if let Some(dash_pos) = part.find('-') {
      let (num_part, suffix_part) = part.split_at(dash_pos);
      if let Ok(num) = num_part.parse::<u32>() {
        version_numbers.push(num);
        suffix = suffix_part.to_string();
      }
      break;
    } else if let Ok(num) = part.parse::<u32>() {
      version_numbers.push(num);
    }
  }

  (version_numbers, suffix)
}

fn compare_versions_with_suffix(v1: &[u32], suffix1: &str, v2: &[u32], suffix2: &str) -> Ordering {
  for (a, b) in v1.iter().zip(v2.iter()) {
    match a.cmp(b) {
      Ordering::Equal => continue,
      other => return other,
    }
  }

  match v1.len().cmp(&v2.len()) {
    Ordering::Equal => match (suffix1.is_empty(), suffix2.is_empty()) {
      (true, false) => Ordering::Greater,
      (false, true) => Ordering::Less,
      _ => suffix1.cmp(suffix2),
    },
    other => other,
  }
}

pub fn version_pack_sort(a: &OtherResourceVersionPack, b: &OtherResourceVersionPack) -> Ordering {
  let (version_a, suffix_a) = parse_version(&a.name);
  let (version_b, suffix_b) = parse_version(&b.name);

  compare_versions_with_suffix(&version_a, &suffix_a, &version_b, &suffix_b).reverse()
}
