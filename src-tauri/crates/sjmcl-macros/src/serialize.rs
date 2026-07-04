use proc_macro::TokenStream;
use quote::quote;
use syn::{Fields, ItemStruct};

pub(crate) fn serialize_skip_none_impl(mut input: ItemStruct) -> TokenStream {
  let fields = match &mut input.fields {
    Fields::Named(fields) => &mut fields.named,
    _ => {
      return syn::Error::new_spanned(
        &input,
        "serialize_skip_none only supports structs with named fields",
      )
      .to_compile_error()
      .into();
    }
  };

  for field in fields.iter_mut() {
    let mut has_skip = false;
    for attr in &field.attrs {
      if attr.path().is_ident("serde")
        && let Ok(meta_list) = attr.meta.require_list()
        && meta_list.tokens.to_string().contains("skip_serializing_if")
      {
        has_skip = true;
        break;
      }
    }

    if has_skip {
      continue;
    }

    if let syn::Type::Path(type_path) = &field.ty
      && let Some(seg) = type_path.path.segments.first()
      && seg.ident == "Option"
    {
      field.attrs.push(syn::parse_quote! {
          #[serde(skip_serializing_if = "Option::is_none")]
      });
    }
  }
  quote! { #input }.into()
}
