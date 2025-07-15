use std::cmp::Ordering;

use crate::resource::models::OtherResourceVersionPack;

fn parse_version(version: &str) -> Vec<u32> {
  version
    .split('.')
    .filter_map(|part| part.parse::<u32>().ok())
    .collect()
}

fn parse_string(input: &str) -> (String, Vec<u32>) {
  if let Some((prefix, version)) = input.rsplit_once(' ') {
    (prefix.to_string(), parse_version(version))
  } else {
    ("".to_string(), parse_version(input))
  }
}

fn compare_versions(v1: &[u32], v2: &[u32]) -> Ordering {
  for (a, b) in v1.iter().zip(v2.iter()) {
    match a.cmp(b) {
      Ordering::Equal => continue,
      other => return other,
    }
  }
  v1.len().cmp(&v2.len())
}

pub fn version_pack_sort(a: &OtherResourceVersionPack, b: &OtherResourceVersionPack) -> Ordering {
  let (prefix_a, version_a) = parse_string(&a.name);
  let (prefix_b, version_b) = parse_string(&b.name);
  match compare_versions(&version_a, &version_b) {
    Ordering::Equal => prefix_a.cmp(&prefix_b),
    other => other.reverse(),
  }
}
