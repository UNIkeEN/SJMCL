use serde::de::DeserializeOwned;

pub fn snake_to_camel_case(snake: &str) -> String {
  let mut camel = String::new();
  let mut capitalize_next = false;

  for (i, ch) in snake.char_indices() {
    if i > 0 && ch == '_' {
      capitalize_next = true;
    } else if capitalize_next {
      camel.push(ch.to_uppercase().next().unwrap_or(ch));
      capitalize_next = false;
    } else {
      camel.push(ch);
    }
  }
  camel
}

pub fn camel_to_snake_case(camel: &str) -> String {
  let mut snake = String::new();
  for (i, ch) in camel.char_indices() {
    if i > 0 && ch.is_uppercase() {
      snake.push('_');
    }
    snake.push(ch.to_ascii_lowercase());
  }
  snake
}

/// Deserializes JSON, stripping raw C0 control characters and retrying if strict parsing fails.
///
/// Some files ship non-standard metadata with raw control characters, so after
/// strict JSON parsing fails, SJMCL strips them and tries parsing again.
pub fn deserialize_lenient_json<T>(input: &str) -> serde_json::Result<T>
where
  T: DeserializeOwned,
{
  Ok(match serde_json::from_str(input) {
    Ok(value) => value,
    Err(_) => serde_json::from_str(&strip_json_control_chars(input))?,
  })
}

/// Removes C0 control characters before a fallback parse of invalid JSON.
pub fn strip_json_control_chars(input: &str) -> String {
  input
    .chars()
    .filter(|c| !matches!(c, '\u{0000}'..='\u{001F}'))
    .collect()
}
