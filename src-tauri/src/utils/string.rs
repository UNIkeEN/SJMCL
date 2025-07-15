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
