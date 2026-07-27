use proc_macro::TokenStream;
use syn::{DeriveInput, ItemStruct, parse_macro_input};

mod partial;
mod serialize;
use partial::derive_partial_impl;
use serialize::serialize_skip_none_impl;

#[proc_macro_derive(Partial)]
pub fn derive_partial(input: TokenStream) -> TokenStream {
  let derived_input = parse_macro_input!(input as DeriveInput);
  derive_partial_impl(&derived_input)
}

/// Automatically add `#[serde(skip_serializing_if = "Option::is_none")]` to all `Option` fields in a struct.
///
/// # Examples
///
/// ```rust
/// #[serialize_skip_none]
/// #[derive(Serialize)]
/// struct Foo { ... }
/// ```
#[proc_macro_attribute]
pub fn serialize_skip_none(_attr: TokenStream, item: TokenStream) -> TokenStream {
  let input = parse_macro_input!(item as ItemStruct);
  serialize_skip_none_impl(input)
}
