use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, Fields, ItemStruct};

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
  let mut input = parse_macro_input!(item as ItemStruct);
  let fields = match &mut input.fields {
    Fields::Named(fields) => &mut fields.named,
    _ => {
      return syn::Error::new_spanned(
        &input,
        "serialize_skip_none only supports structs with named fields",
      )
      .to_compile_error()
      .into()
    }
  };

  for field in fields.iter_mut() {
    // Skip fields that already have skip_serializing_if
    let mut has_skip = false;
    for attr in &field.attrs {
      if attr.path().is_ident("serde") {
        if let Ok(meta_list) = attr.meta.require_list() {
          if meta_list.tokens.to_string().contains("skip_serializing_if") {
            has_skip = true;
            break;
          }
        }
      }
    }

    if has_skip {
      continue;
    }

    // If the field type is Option
    if let syn::Type::Path(type_path) = &field.ty {
      if let Some(seg) = type_path.path.segments.first() {
        if seg.ident == "Option" {
          // Add #[serde(skip_serializing_if = "Option::is_none")]
          field.attrs.push(syn::parse_quote! {
              #[serde(skip_serializing_if = "Option::is_none")]
          });
        }
      }
    }
  }

  quote! { #input }.into()
}
