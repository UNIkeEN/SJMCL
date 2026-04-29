mod partial;
mod serialize_skip_none;

use partial::derive_partial_impl;
use proc_macro::TokenStream;
use serialize_skip_none::serialize_skip_none_impl;

/// Allow a struct to be accessed and updated partially using dot-separated paths.
///
/// # Examples
///
/// ```rust
/// #[derive(Partial)]
/// struct Foo { ... }
/// ```
#[proc_macro_derive(Partial)]
pub fn derive_partial(input: TokenStream) -> TokenStream {
  derive_partial_impl(input)
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
  serialize_skip_none_impl(_attr, item)
}
