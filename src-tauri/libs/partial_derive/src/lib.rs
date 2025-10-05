use proc_macro::TokenStream;
use quote::quote;
use syn::DeriveInput;

#[proc_macro_derive(Partial)]
pub fn derive_partial(input: TokenStream) -> TokenStream {
    let derived_input = syn::parse_macro_input!(input as DeriveInput);
    derive_partial_traits(&derived_input)
}

fn derive_partial_traits(input: &syn::DeriveInput) -> TokenStream {
    let ident = &input.ident;
    let fields = match &input.data {
        syn::Data::Struct(data) => &data.fields,
        _ => panic!("Partial Update derive only supports structs"),
    };

    let access_match_arms = fields.iter().map(|field| {
        let field_name = field.ident.as_ref().unwrap();
        quote! {
            stringify!(#field_name) => (&self.#field_name).access(rest as &str),
        }
    });

    let update_match_arms = fields.iter().map(|field| {
        let field_name = field.ident.as_ref().unwrap();
        quote! {
            stringify!(#field_name) => {
                (&mut self.#field_name).update(rest, value)
            }
        }
    });

    let expanded = quote! {
        impl crate::partial::PartialAccess<'_> for #ident {
            fn access(&self, path: &str) -> crate::partial::PartialResult<String> {
                if path.is_empty() {
                    Ok(serde_json::to_string(self).unwrap())
                } else {
                    let (field, rest) = path.split_once('.').unwrap_or((path, ""));
                    match field {
                        #(#access_match_arms)*
                        _ => Err(crate::partial::PartialError::NotFound),
                    }
                }
            }
        }

        impl crate::partial::PartialUpdate<'_> for #ident {
            fn update (&mut self, path: &str, value: &str) -> crate::partial::PartialResult<()> {
                if path.is_empty() {
                    match serde_json::from_str::<Self>(value) {
                        Ok(value) => {*self = value; Ok(())},
                        Err(e) => Err(crate::partial::PartialError::InvalidType),
                    }
                } else {
                    let (field, rest) = path.split_once('.').unwrap_or((path, ""));
                    match field {
                        #(#update_match_arms)*
                        _ => Err(crate::partial::PartialError::NotFound),
                    }
                }
            }
        }
    };
    expanded.into()
}
