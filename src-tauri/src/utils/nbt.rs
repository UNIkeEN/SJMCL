use quartz_nbt::NbtTag;
use serde_json::Value;

pub fn nbt_to_display_value(tag: NbtTag) -> Value {
  match tag {
    NbtTag::Compound(data) => Value::Object(
      data
        .into_inner()
        .into_iter()
        .map(|(key, value)| (key, nbt_to_display_value(value)))
        .collect(),
    ),
    NbtTag::List(data) => Value::Array(
      data
        .into_inner()
        .into_iter()
        .map(nbt_to_display_value)
        .collect(),
    ),
    NbtTag::Byte(value) => value.into(),
    NbtTag::Short(value) => value.into(),
    NbtTag::Int(value) => value.into(),
    // Preserve seeds and other large integers across the JavaScript boundary.
    NbtTag::Long(value) if !(-9_007_199_254_740_991..=9_007_199_254_740_991).contains(&value) => {
      value.to_string().into()
    }
    NbtTag::Long(value) => value.into(),
    NbtTag::Float(value) if !value.is_finite() => value.to_string().into(),
    NbtTag::Float(value) => value.into(),
    NbtTag::Double(value) if !value.is_finite() => value.to_string().into(),
    NbtTag::Double(value) => value.into(),
    NbtTag::String(value) => value.into(),
    NbtTag::ByteArray(values) => values.into(),
    NbtTag::IntArray(values) => values.into(),
    NbtTag::LongArray(values) => Value::Array(
      values
        .into_iter()
        .map(|value| nbt_to_display_value(NbtTag::Long(value)))
        .collect(),
    ),
  }
}
