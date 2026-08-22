use proc_macro::TokenStream;
use proc_macro2::{Span, TokenStream as TS2, TokenTree};
use quote::{ToTokens, quote};
use std::collections::BTreeMap;
use syn::ext::IdentExt;
use syn::parse::discouraged::Speculative;
use syn::parse::{Parse, ParseStream};
use syn::{
  Expr, ExprPath, Ident, LitStr, Token, Type, braced, parenthesized, parse_macro_input, token,
};

// ---------------------------------------------------------------------------
// Schema model (structstruck-compatible nested declarations)
// ---------------------------------------------------------------------------

/// Node kind in the symbol table.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum NodeKind {
  Leaf,
  Struct,
  Enum,
}

/// A path -> type-name entry in the schema symbol table.
#[derive(Debug, Clone)]
struct PathEntry {
  path: String,
  ty: String,
  #[allow(dead_code)]
  kind: NodeKind,
}

type SymbolTable = BTreeMap<String, PathEntry>;

/// Registry of all named structs/enums (top-level or nested), used to resolve
/// container children during flattening and wrap checks.
#[derive(Debug, Default)]
struct TypeRegistry {
  structs: BTreeMap<String, Vec<(String, String)>>,
  enums: BTreeMap<String, Vec<VariantReg>>,
}

#[derive(Debug, Clone)]
struct VariantReg {
  name: String,
  kind: NodeKind,
  fields: Vec<(String, String)>,
}

/// A field's type: either a leaf Rust type or a nested struct/enum definition.
#[derive(Debug, Clone)]
enum FieldTy {
  Leaf(Type),
  Nested(ItemDef),
}

#[derive(Debug, Clone)]
enum ItemDef {
  Struct(StructDef),
  Enum(EnumDef),
}

#[derive(Debug, Clone)]
struct StructDef {
  name: Ident,
  fields: Vec<(Ident, FieldTy)>,
}

#[derive(Debug, Clone)]
struct EnumDef {
  name: Ident,
  variants: Vec<VariantDef>,
}

#[derive(Debug, Clone)]
struct VariantDef {
  name: Ident,
  fields: VariantFields,
}

#[derive(Debug, Clone)]
enum VariantFields {
  Named(Vec<(Ident, FieldTy)>),
  Tuple,
  Unit,
}

/// Operations understood by the DSL. Model-level operations describe schema
/// evolution from the baseline; they also translate to runtime ops
/// (see `op_to_tokens`).
#[derive(Debug, Clone)]
enum Op {
  /// Add a new top-level model (struct/enum) to the schema. `raw` keeps the
  /// declaration (with attributes) for structstruck type generation.
  AddModel {
    def: ItemDef,
    raw: TS2,
  },
  /// Remove a top-level model and its subtree.
  RemoveModel {
    name: String,
  },
  /// Rename a top-level model (and every path under it).
  RenameModel {
    from: String,
    to: String,
  },
  Rename {
    from: String,
    to: String,
  },
  Move {
    from: String,
    to: String,
  },
  /// Convert the value at `path` from `from_ty` to `to_ty`.
  ///
  /// Three forms:
  /// - `convert "a.b" from B to C;` — built-in whitelist conversion
  /// - `convert "a.b" from B to C : expr;` — fill `expr` when missing
  /// - `convert "a.b" from B to C => fn;` — user-supplied helper; when `f`
  ///   is absent the model-level `convert_field` helper is used as fallback,
  ///   then the built-in whitelist.
  Convert {
    path: String,
    from_ty: Option<String>,
    to_ty: Option<String>,
    default: Option<Expr>,
    f: Option<ExprPath>,
  },
  Remove {
    path: String,
  },
}

/// A three-part version `major.minor.patch`, ordered lexicographically.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
struct Version {
  major: u32,
  minor: u32,
  patch: u32,
}

impl std::fmt::Display for Version {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
  }
}

impl Version {
  fn to_tokens(&self) -> TS2 {
    let mj = self.major;
    let mn = self.minor;
    let pt = self.patch;
    quote! { ::sjmcl_migration::Version { major: #mj, minor: #mn, patch: #pt } }
  }
}

#[derive(Debug, Clone)]
struct Migration {
  from: Version,
  to: Version,
  ops: Vec<Op>,
}

/// One explicitly-declared schema state (a required intermediate version).
#[derive(Debug, Clone)]
struct SchemaBlock {
  version: Version,
  /// Raw schema tokens, forwarded verbatim to `structstruck::strike!`.
  raw_tokens: TS2,
  /// Mutable roots (expand into the symbol table; every field is addressable).
  roots: Vec<ItemDef>,
  /// Auxiliary types (`#[aux]`): generated as real types and referenceable as
  /// field types, but not expanded into the symbol table (no migration paths).
  aux: Vec<ItemDef>,
  /// Model-level default conversion helpers (`convert_field "Model.field" from B to C => fn;`).
  convert_fields: Vec<ConvertField>,
}

/// A model-level default conversion registration: when a `convert` op on
/// `path` carries no helper, this helper is used instead of the whitelist.
#[derive(Debug, Clone)]
struct ConvertField {
  path: String,
  f: ExprPath,
}

/// Parsed form of the whole `migrations!` input.
struct MigrationsInput {
  schemas: Vec<SchemaBlock>,
  migrations: Vec<Migration>,
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

impl Parse for MigrationsInput {
  fn parse(input: ParseStream) -> syn::Result<Self> {
    let mut schemas = Vec::new();
    let mut migrations = Vec::new();

    while !input.is_empty() {
      if input.peek(Ident) && input.peek2(Ident) {
        let kw: Ident = input.parse()?;
        if kw != "schema" {
          return Err(syn::Error::new(
            kw.span(),
            "expected `schema vN { ... }` block or a `vN -> vN { ... }` migration block",
          ));
        }
        let vident: Ident = input.parse()?;
        let version = parse_version_ident(&vident)?;
        // Optional `.M[.P]` segments (note: `v1.1.2` lexes the tail as a float literal).
        let (minor, patch) = parse_version_segments(&input)?;
        let version = Version {
          major: version,
          minor,
          patch,
        };
        let content;
        braced!(content in input);
        let raw_tokens: TS2 = content.parse()?;
        let (clean_tokens, convert_fields) = extract_convert_fields(raw_tokens)?;
        let (roots, aux) = parse_root_items(&clean_tokens)?;
        schemas.push(SchemaBlock {
          version,
          raw_tokens: clean_tokens,
          roots,
          aux,
          convert_fields,
        });
      } else {
        migrations.push(parse_migration(input)?);
      }
    }

    Ok(MigrationsInput {
      schemas,
      migrations,
    })
  }
}

/// Split `convert_field "Model.field" from B to C => fn;` declarations out of
/// the schema tokens (they are DSL, not structstruck input).
fn extract_convert_fields(ts: TS2) -> syn::Result<(TS2, Vec<ConvertField>)> {
  let parser = |input: ParseStream| -> syn::Result<(TS2, Vec<ConvertField>)> {
    let mut clean = TS2::new();
    let mut fields = Vec::new();
    while !input.is_empty() {
      // Peek for `convert_field` (an ident followed by a string literal).
      if input.peek(Ident) && input.peek2(LitStr) {
        let ahead = input.fork();
        let kw: Ident = ahead.parse()?;
        if kw == "convert_field" {
          let path: LitStr = ahead.parse()?;
          let _from_kw: Ident = ahead.parse()?;
          let _from_ty: Type = ahead.parse()?;
          let _to_kw: Ident = ahead.parse()?;
          let _to_ty: Type = ahead.parse()?;
          let _arrow: Token![=>] = ahead.parse()?;
          let f: ExprPath = ahead.parse()?;
          let _semi: Token![;] = ahead.parse()?;
          input.advance_to(&ahead);
          fields.push(ConvertField {
            path: path.value(),
            f,
          });
          continue;
        }
      }
      clean.extend([input.parse::<TokenTree>()?]);
    }
    Ok((clean, fields))
  };
  syn::parse::Parser::parse2(parser, ts)
}

/// Marker for a top-level declaration: `#[aux]` types are not addressable.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RootMark {
  Root,
  Aux,
}

fn parse_root_items(ts: &TS2) -> syn::Result<(Vec<ItemDef>, Vec<ItemDef>)> {
  let parser = |input: ParseStream| -> syn::Result<(Vec<ItemDef>, Vec<ItemDef>)> {
    let mut roots = Vec::new();
    let mut aux = Vec::new();
    while !input.is_empty() {
      let (item, mark) = parse_item_def(input)?;
      match mark {
        RootMark::Aux => aux.push(item),
        RootMark::Root => roots.push(item),
      }
    }
    Ok((roots, aux))
  };
  syn::parse::Parser::parse2(parser, ts.clone())
}

/// Skip any outer (`#[...]`) and inner (`#![...]`) attributes in a row.
/// structstruck pseudo-attributes (`each`, `long_names`, ...) appear this way.
/// Returns the skipped attributes so callers can inspect e.g. `#[root]`.
fn skip_attrs(input: ParseStream) -> syn::Result<Vec<syn::Attribute>> {
  let mut attrs = Vec::new();
  while input.peek(Token![#]) {
    if input.peek2(Token![!]) {
      attrs.extend(input.call(syn::Attribute::parse_inner)?);
    } else {
      attrs.extend(input.call(syn::Attribute::parse_outer)?);
    }
  }
  Ok(attrs)
}

fn parse_item_def(input: ParseStream) -> syn::Result<(ItemDef, RootMark)> {
  parse_item_def_opt(input, false)
}

/// `bare_ok` allows a declaration without the `struct`/`enum` keyword, treated
/// as a struct — used by `add_model ServerConfig { ... }`.
fn parse_item_def_opt(input: ParseStream, bare_ok: bool) -> syn::Result<(ItemDef, RootMark)> {
  // Skip outer attributes (e.g. #[structstruck::each[...]], #[derive(...)])
  // and the visibility modifier (`pub`). `#[aux]` marks a non-addressable type.
  let attrs = skip_attrs(input)?;
  let mark = if attrs.iter().any(|a| a.path().is_ident("aux")) {
    RootMark::Aux
  } else {
    RootMark::Root
  };
  let _: syn::Visibility = input.parse()?;
  if input.peek(Token![struct]) {
    let _: Token![struct] = input.parse()?;
    let name: Ident = input.parse()?;
    let fields = parse_named_fields(input)?;
    Ok((ItemDef::Struct(StructDef { name, fields }), mark))
  } else if input.peek(Token![enum]) {
    parse_item_enum(input, mark)
  } else if bare_ok && input.peek(Ident) {
    // `add_model ServerConfig { ... }` — bare struct name.
    let name: Ident = input.parse()?;
    let fields = parse_named_fields(input)?;
    Ok((ItemDef::Struct(StructDef { name, fields }), mark))
  } else {
    Err(input.error("expected `struct` or `enum` declaration in schema"))
  }
}

fn parse_item_enum(input: ParseStream, mark: RootMark) -> syn::Result<(ItemDef, RootMark)> {
  let _: Token![enum] = input.parse()?;
  let name: Ident = input.parse()?;
  let content;
  braced!(content in input);
  // Skip inner attributes (e.g. #![structstruck::each[...]]).
  let _ = skip_attrs(&content)?;
  let mut variants = Vec::new();
  while !content.is_empty() {
    let _ = skip_attrs(&content)?;
    let vname: Ident = content.parse()?;
    if content.peek(token::Brace) {
      let fields = parse_named_fields(&content)?;
      variants.push(VariantDef {
        name: vname,
        fields: VariantFields::Named(fields),
      });
    } else if content.peek(token::Paren) {
      let tuple_content;
      parenthesized!(tuple_content in content);
      while !tuple_content.is_empty() {
        let _ = parse_field_ty(&tuple_content, &vname.to_string())?;
        if tuple_content.peek(Token![,]) {
          tuple_content.parse::<Token![,]>()?;
        }
      }
      variants.push(VariantDef {
        name: vname,
        fields: VariantFields::Tuple,
      });
    } else {
      variants.push(VariantDef {
        name: vname,
        fields: VariantFields::Unit,
      });
    }
    if content.peek(Token![,]) {
      content.parse::<Token![,]>()?;
    }
  }
  Ok((ItemDef::Enum(EnumDef { name, variants }), mark))
}

/// Parse `{ field: FieldTy, ... }` (named fields).
fn parse_named_fields(input: ParseStream) -> syn::Result<Vec<(Ident, FieldTy)>> {
  let content;
  braced!(content in input);
  // Skip inner attributes (structstruck inner-attribute style).
  skip_attrs(&content)?;
  let mut fields = Vec::new();
  while !content.is_empty() {
    // Each field may carry attributes (#[default = ...], #[serde(...)], ...)
    // and a visibility modifier (`pub`).
    skip_attrs(&content)?;
    let _: syn::Visibility = content.parse()?;
    let field: Ident = content.parse()?;
    let _colon: Token![:] = content.parse()?;
    let ty = parse_field_ty(&content, &field.to_string())?;
    fields.push((field, ty));
    if content.peek(Token![,]) {
      content.parse::<Token![,]>()?;
    }
  }
  Ok(fields)
}

/// Infer a structstruck-style type name from a field name: `basic_info` -> `BasicInfo`.
fn pascal_case(s: &str) -> String {
  s.split('_')
    .filter(|p| !p.is_empty())
    .map(|p| {
      let mut chars = p.chars();
      match chars.next() {
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
      }
    })
    .collect()
}

/// Convert a snake_case field name to camelCase, matching serde's
/// `rename_all = "camelCase"`. Migration op paths address JSON document keys,
/// so the symbol table must use the serialized names too.
fn camel_case(s: &str) -> String {
  let mut out = String::new();
  let mut capitalize_next = false;
  for c in s.chars() {
    if c == '_' {
      capitalize_next = true;
    } else if capitalize_next {
      out.extend(c.to_uppercase());
      capitalize_next = false;
    } else {
      out.push(c);
    }
  }
  out
}

/// A field type is either a leaf Rust type or a nested `struct`/`enum`.
/// `name_hint` is the enclosing field name, used to infer a name for anonymous
/// nested declarations (`basic_info: struct { ... }` -> `BasicInfo`).
fn parse_field_ty(input: ParseStream, name_hint: &str) -> syn::Result<FieldTy> {
  // Skip attributes preceding a nested struct/enum (structstruck style).
  skip_attrs(input)?;
  if input.peek(Token![struct]) {
    let _: Token![struct] = input.parse()?;
    let name: Ident = if input.peek(Ident) {
      input.parse()?
    } else {
      Ident::new(&pascal_case(name_hint), Span::call_site())
    };
    let fields = parse_named_fields(input)?;
    Ok(FieldTy::Nested(ItemDef::Struct(StructDef { name, fields })))
  } else if input.peek(Token![enum]) {
    let _: Token![enum] = input.parse()?;
    let name: Ident = if input.peek(Ident) {
      input.parse()?
    } else {
      Ident::new(&pascal_case(name_hint), Span::call_site())
    };
    let content;
    braced!(content in input);
    skip_attrs(&content)?;
    let mut variants = Vec::new();
    while !content.is_empty() {
      let vname: Ident = content.parse()?;
      if content.peek(token::Brace) {
        let fields = parse_named_fields(&content)?;
        variants.push(VariantDef {
          name: vname,
          fields: VariantFields::Named(fields),
        });
      } else if content.peek(token::Paren) {
        let tuple_content;
        parenthesized!(tuple_content in content);
        while !tuple_content.is_empty() {
          let _ = parse_field_ty(&tuple_content, &vname.to_string())?;
          if tuple_content.peek(Token![,]) {
            tuple_content.parse::<Token![,]>()?;
          }
        }
        variants.push(VariantDef {
          name: vname,
          fields: VariantFields::Tuple,
        });
      } else {
        variants.push(VariantDef {
          name: vname,
          fields: VariantFields::Unit,
        });
      }
      if content.peek(Token![,]) {
        content.parse::<Token![,]>()?;
      }
    }
    Ok(FieldTy::Nested(ItemDef::Enum(EnumDef { name, variants })))
  } else {
    let ty: Type = input.parse()?;
    Ok(FieldTy::Leaf(ty))
  }
}

fn parse_migration(input: ParseStream) -> syn::Result<Migration> {
  let v1: Ident = input.parse()?;
  let from_major = parse_version_ident(&v1)?;
  let (from_minor, from_patch) = parse_version_segments(input)?;
  let _arrow: Token![->] = input.parse()?;
  let v2: Ident = input.parse()?;
  let to_major = parse_version_ident(&v2)?;
  let (to_minor, to_patch) = parse_version_segments(input)?;

  let content;
  braced!(content in input);

  let mut ops = Vec::new();
  while !content.is_empty() {
    ops.push(parse_op(&content)?);
  }

  Ok(Migration {
    from: Version {
      major: from_major,
      minor: from_minor,
      patch: from_patch,
    },
    to: Version {
      major: to_major,
      minor: to_minor,
      patch: to_patch,
    },
    ops,
  })
}

fn parse_version_ident(id: &Ident) -> syn::Result<u32> {
  let s = id.to_string();
  let num = s
    .strip_prefix('v')
    .ok_or_else(|| syn::Error::new(id.span(), format!("expected `v<N>`, found `{s}`")))?
    .parse::<u32>()
    .map_err(|_| syn::Error::new(id.span(), format!("invalid version `{s}`")))?;
  Ok(num)
}

/// Parse up to two trailing `.M` / `.M.P` segments.
///
/// Rust lexes `v1.1.2` as `Ident(v1) Punct(.) Lit(1.2)` — the tail is a float
/// literal — so a float is split on its `.`. Segments beyond patch are rejected.
fn parse_version_segments(input: ParseStream) -> syn::Result<(u32, u32)> {
  let mut segs = [0u32, 0u32];
  let mut idx = 0usize;
  while input.peek(Token![.]) {
    input.parse::<Token![.]>()?;
    let lit: syn::Lit = input.parse()?;
    match lit {
      syn::Lit::Int(i) => {
        if idx >= 2 {
          return Err(syn::Error::new(
            i.span(),
            "version has more than three segments",
          ));
        }
        segs[idx] = i.base10_parse::<u32>()?;
        idx += 1;
      }
      syn::Lit::Float(f) => {
        let digits = f.base10_digits().to_string();
        let mut parts = digits.split('.');
        let major_seg = parts.next().unwrap_or("0");
        let minor_seg = parts
          .next()
          .ok_or_else(|| syn::Error::new(f.span(), "invalid float version segment"))?;
        if idx >= 2 || idx + 1 >= 2 {
          return Err(syn::Error::new(
            f.span(),
            "version has more than three segments",
          ));
        }
        segs[idx] = major_seg
          .parse::<u32>()
          .map_err(|_| syn::Error::new(f.span(), "invalid version segment"))?;
        segs[idx + 1] = minor_seg
          .parse::<u32>()
          .map_err(|_| syn::Error::new(f.span(), "invalid version segment"))?;
        idx += 2;
      }
      other => {
        return Err(syn::Error::new(
          other.span(),
          "expected integer in version segment",
        ));
      }
    }
  }
  Ok((segs[0], segs[1]))
}

fn parse_op(input: ParseStream) -> syn::Result<Op> {
  // `move` is a reserved keyword; parse_any lets us accept it (or `r#move`).
  let kw = Ident::parse_any(input)?;
  match kw.to_string().as_str() {
    "add_model" => {
      // Capture attributes (they apply to the generated type) + the bare
      // declaration, re-serialized so structstruck can generate the type.
      let attrs = skip_attrs(input)?;
      let def = parse_item_def_opt(input, true)?.0;
      let raw: TS2 = {
        let attrs_ts: TS2 = attrs.iter().map(|a| quote!(#a)).collect();
        let def_ts = item_def_to_tokens(&def);
        quote! { #attrs_ts #def_ts }
      };
      let _semi: Token![;] = input.parse()?;
      Ok(Op::AddModel { def, raw })
    }
    "remove_model" => {
      let name: Ident = input.parse()?;
      let _semi: Token![;] = input.parse()?;
      Ok(Op::RemoveModel {
        name: name.to_string(),
      })
    }
    "rename_model" => {
      let from: Ident = input.parse()?;
      let _arrow: Token![=>] = input.parse()?;
      let to: Ident = input.parse()?;
      let _semi: Token![;] = input.parse()?;
      Ok(Op::RenameModel {
        from: from.to_string(),
        to: to.to_string(),
      })
    }
    "rename" => {
      let from: LitStr = input.parse()?;
      let _arrow: Token![=>] = input.parse()?;
      let to: LitStr = input.parse()?;
      let _semi: Token![;] = input.parse()?;
      Ok(Op::Rename {
        from: from.value(),
        to: to.value(),
      })
    }
    "r#move" | "move" => {
      let from: LitStr = input.parse()?;
      let _arrow: Token![=>] = input.parse()?;
      let to: LitStr = input.parse()?;
      let _semi: Token![;] = input.parse()?;
      Ok(Op::Move {
        from: from.value(),
        to: to.value(),
      })
    }
    // `convert "a.b" from B to C [: expr | => fn];`
    // The `from B to C` part is optional; when omitted the op only fills
    // a default (`: expr`) or applies a helper (`=> fn`) without touching
    // the symbol table types.
    "convert" => {
      let path: LitStr = input.parse()?;
      let mut from_ty = None;
      let mut to_ty = None;
      if input.peek(Ident) {
        let kw: Ident = input.parse()?;
        if kw == "from" {
          let ft: Type = input.parse()?;
          let _to_kw: Ident = input.parse()?;
          let tt: Type = input.parse()?;
          from_ty = Some(ty_name(&ft));
          to_ty = Some(ty_name(&tt));
        } else {
          return Err(syn::Error::new(
            kw.span(),
            format!("expected `from`, found `{kw}`"),
          ));
        }
      }
      let mut default = None;
      let mut f = None;
      if input.peek(Token![:]) {
        let _colon: Token![:] = input.parse()?;
        default = Some(input.parse()?);
      } else if input.peek(Token![=>]) {
        let _arrow: Token![=>] = input.parse()?;
        f = Some(input.parse()?);
      }
      let _semi: Token![;] = input.parse()?;
      Ok(Op::Convert {
        path: path.value(),
        from_ty,
        to_ty,
        default,
        f,
      })
    }
    "remove" | "remove_field" => {
      let path: LitStr = input.parse()?;
      let _semi: Token![;] = input.parse()?;
      Ok(Op::Remove { path: path.value() })
    }
    other => Err(syn::Error::new(
      kw.span(),
      format!("unknown operation `{other}`"),
    )),
  }
}

// ---------------------------------------------------------------------------
// Symbol table construction
// ---------------------------------------------------------------------------

fn ty_name(t: &Type) -> String {
  t.to_token_stream().to_string().replace(' ', "")
}

fn field_ty_name(ft: &FieldTy) -> String {
  match ft {
    FieldTy::Leaf(t) => ty_name(t),
    FieldTy::Nested(ItemDef::Struct(s)) => s.name.to_string(),
    FieldTy::Nested(ItemDef::Enum(e)) => e.name.to_string(),
  }
}

/// Build the full registry of named structs/enums from the (possibly nested)
/// schema declaration tree.
fn build_registry(roots: &[ItemDef]) -> TypeRegistry {
  let mut reg = TypeRegistry::default();
  let mut stack: Vec<ItemDef> = roots.iter().cloned().collect();
  while let Some(item) = stack.pop() {
    match item {
      ItemDef::Struct(s) => {
        let fields: Vec<(String, String)> = s
          .fields
          .iter()
          .map(|(n, t)| (n.to_string(), field_ty_name(t)))
          .collect();
        reg.structs.insert(s.name.to_string(), fields);
        for (_, t) in s.fields {
          if let FieldTy::Nested(nested) = t {
            stack.push(nested);
          }
        }
      }
      ItemDef::Enum(e) => {
        let mut variants = Vec::new();
        for v in e.variants {
          let (kind, fields) = match &v.fields {
            VariantFields::Named(fs) => {
              let fields: Vec<(String, String)> = fs
                .iter()
                .map(|(n, t)| (n.to_string(), field_ty_name(t)))
                .collect();
              (NodeKind::Struct, fields)
            }
            VariantFields::Tuple => (NodeKind::Leaf, Vec::new()),
            VariantFields::Unit => (NodeKind::Leaf, Vec::new()),
          };
          variants.push(VariantReg {
            name: v.name.to_string(),
            kind,
            fields,
          });
          if let VariantFields::Named(fs) = &v.fields {
            for (_, t) in fs {
              if let FieldTy::Nested(nested) = t {
                stack.push((*nested).clone());
              }
            }
          }
        }
        reg.enums.insert(e.name.to_string(), variants);
      }
    }
  }
  reg
}

/// Flatten the schema into a path -> type symbol table.
///
/// Every top-level declaration is a root. A single root is flattened with flat
/// paths (`name`, `theme.color`); with multiple roots each root is namespaced
/// by its type name (`ServerConfig.host`). A reference cycle between types is a
/// compile error (`A -> B -> A`).
fn flatten_schema(roots: &[ItemDef], registry: &TypeRegistry) -> Result<SymbolTable, syn::Error> {
  let mut table = SymbolTable::new();
  let multi = roots.len() > 1;
  for root in roots {
    let name = match root {
      ItemDef::Struct(s) => s.name.to_string(),
      ItemDef::Enum(e) => e.name.to_string(),
    };
    let prefix = if multi { name.clone() } else { String::new() };
    let mut stack = vec![name.clone()];
    match root {
      ItemDef::Struct(_) => flatten_named(&name, &prefix, registry, &mut table, &mut stack)?,
      ItemDef::Enum(e) => {
        // Root enum is unusual; flatten its variants at top level.
        for v in &e.variants {
          let vpath = if prefix.is_empty() {
            v.name.to_string()
          } else {
            format!("{prefix}.{}", v.name)
          };
          let (kind, fields) = match &v.fields {
            VariantFields::Named(fs) => {
              let fields: Vec<(String, String)> = fs
                .iter()
                .map(|(n, t)| (n.to_string(), field_ty_name(t)))
                .collect();
              (NodeKind::Struct, fields)
            }
            _ => (NodeKind::Leaf, Vec::new()),
          };
          let vreg = VariantReg {
            name: v.name.to_string(),
            kind,
            fields,
          };
          flatten_variant(&vpath, &vreg, registry, &mut table, &mut stack)?;
        }
      }
    }
  }
  Ok(table)
}

fn flatten_named(
  name: &str,
  prefix: &str,
  registry: &TypeRegistry,
  table: &mut SymbolTable,
  stack: &mut Vec<String>,
) -> Result<(), syn::Error> {
  if let Some(fields) = registry.structs.get(name) {
    for (fname, fty) in fields {
      let fname = camel_case(fname);
      let path = if prefix.is_empty() {
        fname
      } else {
        format!("{prefix}.{fname}")
      };
      let kind = node_kind(fty, registry);
      table.insert(
        path.clone(),
        PathEntry {
          path: path.clone(),
          ty: fty.clone(),
          kind,
        },
      );
      if kind != NodeKind::Leaf {
        enter_type(fty, path, registry, table, stack)?;
      }
    }
  } else if let Some(variants) = registry.enums.get(name) {
    for v in variants {
      let vpath = if prefix.is_empty() {
        v.name.clone()
      } else {
        format!("{prefix}.{}", v.name)
      };
      flatten_variant(&vpath, v, registry, table, stack)?;
    }
  }
  Ok(())
}

/// Recurse into a container type, detecting reference cycles.
fn enter_type(
  ty: &str,
  path: String,
  registry: &TypeRegistry,
  table: &mut SymbolTable,
  stack: &mut Vec<String>,
) -> Result<(), syn::Error> {
  if stack.contains(&ty.to_string()) {
    let mut cycle = stack.clone();
    cycle.push(ty.to_string());
    return Err(syn::Error::new(
      Span::call_site(),
      format!("circular reference between types: {}", cycle.join(" -> ")),
    ));
  }
  stack.push(ty.to_string());
  flatten_named(ty, &path, registry, table, stack)?;
  stack.pop();
  Ok(())
}

fn flatten_variant(
  vpath: &str,
  v: &VariantReg,
  registry: &TypeRegistry,
  table: &mut SymbolTable,
  stack: &mut Vec<String>,
) -> Result<(), syn::Error> {
  table.insert(
    vpath.to_string(),
    PathEntry {
      path: vpath.to_string(),
      ty: v.name.clone(),
      kind: v.kind,
    },
  );
  if v.kind == NodeKind::Struct {
    for (fname, fty) in &v.fields {
      let child = format!("{vpath}.{}", camel_case(fname));
      let kind = node_kind(fty, registry);
      table.insert(
        child.clone(),
        PathEntry {
          path: child.clone(),
          ty: fty.clone(),
          kind,
        },
      );
      if kind != NodeKind::Leaf {
        enter_type(fty, child, registry, table, stack)?;
      }
    }
  }
  Ok(())
}

fn node_kind(ty: &str, registry: &TypeRegistry) -> NodeKind {
  if registry.structs.contains_key(ty) {
    NodeKind::Struct
  } else if registry.enums.contains_key(ty) {
    NodeKind::Enum
  } else {
    NodeKind::Leaf
  }
}

// ---------------------------------------------------------------------------
// Soundness validation (forward simulation against declared intermediate states)
// ---------------------------------------------------------------------------

fn validate(schemas: &[SchemaBlock], migrations: &[Migration]) -> Result<(), Vec<syn::Error>> {
  let mut errors = Vec::new();

  // 0. Exactly one baseline schema block (later versions are described as
  //    incremental changes inside migration blocks).
  if schemas.len() != 1 {
    errors.push(syn::Error::new(
      Span::call_site(),
      format!(
        "expected exactly one baseline `schema` block, found {}; \
                 describe subsequent versions as changes inside `vN -> vM` blocks",
        schemas.len()
      ),
    ));
    return Err(errors);
  }
  let baseline = &schemas[0];

  // 1. Migration chain: strictly increasing, internally contiguous (each
  //    `from` equals the previous `to`), no duplicates, ends at baseline.
  //    The schema block declares the current (baseline) version; migrations
  //    describe how older documents are restored up to it.
  let mut pairs: Vec<(Version, Version)> = migrations.iter().map(|m| (m.from, m.to)).collect();
  pairs.sort_unstable();
  let mut seen = std::collections::HashSet::new();
  let mut prev_to: Option<Version> = None;
  for (i, (from, to)) in pairs.iter().enumerate() {
    if !seen.insert((*from, *to)) {
      errors.push(syn::Error::new(
        Span::call_site(),
        format!("duplicate migration {from} -> {to}"),
      ));
    }
    if *to <= *from {
      errors.push(syn::Error::new(
        Span::call_site(),
        format!("migration must go forward ({from} -> {to})"),
      ));
    }
    if let Some(p) = prev_to {
      if i > 0 && *from != p {
        errors.push(syn::Error::new(
          Span::call_site(),
          format!("migration chain is not contiguous: expected from version {p}, found {from}"),
        ));
      }
    }
    prev_to = Some(*to);
  }
  if let Some(last) = pairs.last() {
    if last.1 != baseline.version {
      errors.push(syn::Error::new(
        Span::call_site(),
        format!(
          "migration chain must end at the baseline version {} (schema), found {}",
          baseline.version, last.1
        ),
      ));
    }
  }

  // 2. Baseline must flatten without reference cycles.
  let (mut cur, mut reg) = match build_version_table(baseline) {
    Ok(t) => t,
    Err(e) => {
      errors.push(e);
      return Err(errors);
    }
  };
  // In a multi-root schema the first root is the document itself; op paths
  // that address it may omit the root prefix (`a.b` == `LauncherConfig.a.b`).
  let doc_root = if baseline.roots.len() > 1 {
    baseline
      .roots
      .iter()
      .find_map(|i| match i {
        ItemDef::Struct(s) => Some(s.name.to_string()),
        ItemDef::Enum(_) => None,
      })
      .unwrap_or_default()
  } else {
    String::new()
  };

  // 3. Evolve the symbol table through each migration's change description.
  //    There is no separately-declared target state to compare against; each
  //    op validates its own references against the current evolved state.
  for m in migrations {
    for op in &m.ops {
      if let Err(e) = apply_forward(op, &mut cur, &mut reg, &doc_root) {
        errors.push(e);
      }
    }
  }

  if errors.is_empty() {
    Ok(())
  } else {
    Err(errors)
  }
}

/// Build the symbol table + registry for one declared version.
/// Auxiliary (`#[aux]`) types contribute to the registry (referenceable field
/// types) but are NOT expanded into the symbol table.
fn build_version_table(block: &SchemaBlock) -> Result<(SymbolTable, TypeRegistry), syn::Error> {
  let mut all: Vec<ItemDef> = block.roots.clone();
  all.extend(block.aux.iter().cloned());
  let reg = build_registry(&all);
  let table = flatten_schema(&block.roots, &reg)?;
  Ok((table, reg))
}

/// Apply a single op to the evolving symbol table/registry, validating that the
/// referenced paths/types are consistent with the current state.
fn apply_forward(
  op: &Op,
  cur: &mut SymbolTable,
  reg: &mut TypeRegistry,
  doc_root: &str,
) -> Result<(), syn::Error> {
  match op {
    Op::AddModel { def, .. } => {
      let name = item_name(def);
      if reg.structs.contains_key(&name) || reg.enums.contains_key(&name) {
        return Err(syn::Error::new(
          Span::call_site(),
          format!("add_model: `{name}` already exists"),
        ));
      }
      add_to_registry(&mut *reg, def);
      // Added models are always name-prefixed (they make the schema multi-root).
      let added = flatten_added_model(def, reg)
        .map_err(|e| syn::Error::new(Span::call_site(), format!("add_model `{name}`: {e}")))?;
      for (p, e) in added {
        cur.entry(p).or_insert(e);
      }
      Ok(())
    }
    Op::RemoveModel { name } => {
      if !has_model(cur, name) {
        return Err(syn::Error::new(
          Span::call_site(),
          format!("remove_model: `{name}` does not exist"),
        ));
      }
      remove_subtree(cur, name);
      reg.structs.remove(name);
      reg.enums.remove(name);
      Ok(())
    }
    Op::RenameModel { from, to } => {
      if !has_model(cur, from) {
        return Err(syn::Error::new(
          Span::call_site(),
          format!("rename_model: `{from}` does not exist"),
        ));
      }
      if has_model(cur, to) {
        return Err(syn::Error::new(
          Span::call_site(),
          format!("rename_model: `{to}` already exists"),
        ));
      }
      if let Some(fields) = reg.structs.remove(from) {
        reg.structs.insert(to.clone(), fields);
      }
      if let Some(variants) = reg.enums.remove(from) {
        reg.enums.insert(to.clone(), variants);
      }
      remap_children(cur, from, to);
      Ok(())
    }
    Op::Rename { from, to } => {
      let from_res = resolve_path(cur, doc_root, from).ok_or_else(|| {
        syn::Error::new(
          Span::call_site(),
          format!("rename: path `{from}` does not exist in the current schema"),
        )
      })?;
      let entry = cur.remove(&from_res).unwrap();
      let to_res = resolve_path(cur, doc_root, to).unwrap_or_else(|| {
        if doc_root.is_empty() {
          to.to_string()
        } else {
          format!("{doc_root}.{to}")
        }
      });
      if cur.contains_key(&to_res) {
        return Err(syn::Error::new(
          Span::call_site(),
          format!("rename: target `{to}` already exists in the simulated state"),
        ));
      }
      let mut new_entry = entry.clone();
      // An enum-variant node's type is the variant name; it follows the rename.
      let from_leaf = from.rsplit('.').next().unwrap_or(from);
      if new_entry.ty == from_leaf {
        new_entry.ty = to.rsplit('.').next().unwrap_or(to).to_string();
      }
      new_entry.path = to_res.clone();
      cur.insert(to_res.clone(), new_entry);
      remap_children(cur, &from_res, &to_res);
      Ok(())
    }
    Op::Move { from, to } => {
      let from_res = resolve_path(cur, doc_root, from).ok_or_else(|| {
        syn::Error::new(
          Span::call_site(),
          format!("move: path `{from}` does not exist in the current schema"),
        )
      })?;
      let entry = cur.remove(&from_res).unwrap();
      let to_res = resolve_path(cur, doc_root, to).unwrap_or_else(|| {
        if doc_root.is_empty() {
          to.to_string()
        } else {
          format!("{doc_root}.{to}")
        }
      });
      if cur.contains_key(&to_res) {
        return Err(syn::Error::new(
          Span::call_site(),
          format!("move: target `{to}` already exists in the simulated state"),
        ));
      }
      let mut new_entry = entry.clone();
      let from_leaf = from.rsplit('.').next().unwrap_or(from);
      if new_entry.ty == from_leaf {
        new_entry.ty = to.rsplit('.').next().unwrap_or(to).to_string();
      }
      new_entry.path = to_res.clone();
      cur.insert(to_res.clone(), new_entry);
      remap_children(cur, &from_res, &to_res);
      Ok(())
    }
    Op::Convert {
      path,
      from_ty,
      to_ty,
      default,
      f,
      ..
    } => {
      let resolved = match resolve_path(cur, doc_root, path) {
        Some(p) => p,
        None => {
          // Missing path: allowed when the op only fills a default (a
          // field introduced at this version). Otherwise it must exist.
          if default.is_none() {
            return Err(syn::Error::new(
              Span::call_site(),
              format!("convert: path `{path}` does not exist in the current schema"),
            ));
          }
          if doc_root.is_empty() {
            path.to_string()
          } else {
            format!("{doc_root}.{path}")
          }
        }
      };
      if !cur.contains_key(&resolved) {
        // Field introduced at this version: register it so later ops
        // can reference it.
        let ty = to_ty.clone().unwrap_or_else(|| "Value".to_string());
        cur.insert(
          resolved.clone(),
          PathEntry {
            path: resolved.clone(),
            ty,
            kind: NodeKind::Leaf,
          },
        );
      }
      let entry = cur.get_mut(&resolved).unwrap();
      // A custom helper defines the conversion itself; the `from X to Y`
      // annotation is documentation and is not enforced against the
      // symbol table. Without a helper the built-in whitelist applies.
      if let (Some(ft), Some(tt)) = (from_ty, to_ty) {
        if f.is_none() {
          if entry.ty != *ft {
            return Err(syn::Error::new(
              Span::call_site(),
              format!(
                "convert: path `{path}` has type `{}` in the current schema, but the op claims it is `{ft}`",
                entry.ty
              ),
            ));
          }
          if !is_convertible(ft, tt) {
            return Err(syn::Error::new(
              Span::call_site(),
              format!("convert: no known conversion from `{ft}` to `{tt}`"),
            ));
          }
        }
        entry.ty = tt.clone();
      }
      Ok(())
    }
    Op::Remove { path } => {
      let resolved = resolve_path(cur, doc_root, path).ok_or_else(|| {
        syn::Error::new(
          Span::call_site(),
          format!("remove: path `{path}` does not exist in the current schema"),
        )
      })?;
      remove_subtree(cur, &resolved);
      Ok(())
    }
  }
}

fn item_name(item: &ItemDef) -> String {
  match item {
    ItemDef::Struct(s) => s.name.to_string(),
    ItemDef::Enum(e) => e.name.to_string(),
  }
}

/// Serialize a parsed model back into declaration tokens (for structstruck).
fn item_def_to_tokens(item: &ItemDef) -> TS2 {
  match item {
    ItemDef::Struct(s) => {
      let name = &s.name;
      let fields = s.fields.iter().map(|(n, t)| {
        let n = n;
        let t = field_ty_to_tokens(t);
        quote!(#n: #t)
      });
      quote!(struct #name { #(#fields,)* })
    }
    ItemDef::Enum(e) => {
      let name = &e.name;
      let variants = e.variants.iter().map(|v| {
        let vname = &v.name;
        match &v.fields {
          VariantFields::Named(fs) => {
            let fields = fs.iter().map(|(n, t)| {
              let n = n;
              let t = field_ty_to_tokens(t);
              quote!(#n: #t)
            });
            quote!(#vname { #(#fields,)* })
          }
          // Tuple payloads are not retained in the model; emit as unit.
          VariantFields::Tuple | VariantFields::Unit => quote!(#vname),
        }
      });
      quote!(enum #name { #(#variants,)* })
    }
  }
}

fn field_ty_to_tokens(ft: &FieldTy) -> TS2 {
  match ft {
    FieldTy::Leaf(t) => quote!(#t),
    FieldTy::Nested(item) => item_def_to_tokens(item),
  }
}

/// Resolve an op path to its canonical symbol-table path. Ops address the
/// document, which is the first root model; in a multi-root schema a path that
/// isn't present verbatim is also accepted with the document root prefixed
/// (`a.b` == `LauncherConfig.a.b`).
fn resolve_path(table: &SymbolTable, doc_root: &str, path: &str) -> Option<String> {
  if table.contains_key(path) {
    return Some(path.to_string());
  }
  if !doc_root.is_empty() {
    let prefixed = format!("{doc_root}.{path}");
    if table.contains_key(&prefixed) {
      return Some(prefixed);
    }
  }
  None
}

/// Whether a model's subtree exists in the symbol table (a model has no entry
/// for its own name; only its descendant paths, e.g. `ServerConfig.host`).
fn has_model(cur: &SymbolTable, name: &str) -> bool {
  cur
    .keys()
    .any(|k| k == name || k.starts_with(&format!("{name}.")))
}

/// Flatten a single model with its type name as path prefix (added models are
/// always name-prefixed, matching a multi-root schema).
fn flatten_added_model(item: &ItemDef, reg: &TypeRegistry) -> Result<SymbolTable, syn::Error> {
  let mut table = SymbolTable::new();
  let name = item_name(item);
  let mut stack = vec![name.clone()];
  match item {
    ItemDef::Struct(_) => flatten_named(&name, &name, reg, &mut table, &mut stack)?,
    ItemDef::Enum(e) => {
      for v in &e.variants {
        let vpath = format!("{name}.{}", v.name);
        let (kind, fields) = match &v.fields {
          VariantFields::Named(fs) => {
            let fields: Vec<(String, String)> = fs
              .iter()
              .map(|(n, t)| (n.to_string(), field_ty_name(t)))
              .collect();
            (NodeKind::Struct, fields)
          }
          _ => (NodeKind::Leaf, Vec::new()),
        };
        let vreg = VariantReg {
          name: v.name.to_string(),
          kind,
          fields,
        };
        flatten_variant(&vpath, &vreg, reg, &mut table, &mut stack)?;
      }
    }
  }
  Ok(table)
}

fn add_to_registry(reg: &mut TypeRegistry, item: &ItemDef) {
  match item {
    ItemDef::Struct(s) => {
      let fields: Vec<(String, String)> = s
        .fields
        .iter()
        .map(|(n, t)| (n.to_string(), field_ty_name(t)))
        .collect();
      reg.structs.insert(s.name.to_string(), fields);
    }
    ItemDef::Enum(e) => {
      let mut variants = Vec::new();
      for v in &e.variants {
        let (kind, fields) = match &v.fields {
          VariantFields::Named(fs) => {
            let fields: Vec<(String, String)> = fs
              .iter()
              .map(|(n, t)| (n.to_string(), field_ty_name(t)))
              .collect();
            (NodeKind::Struct, fields)
          }
          _ => (NodeKind::Leaf, Vec::new()),
        };
        variants.push(VariantReg {
          name: v.name.to_string(),
          kind,
          fields,
        });
      }
      reg.enums.insert(e.name.to_string(), variants);
    }
  }
}

/// Move all entries whose path starts with `old` prefix to `new` prefix.
fn remap_children(table: &mut SymbolTable, old: &str, new: &str) {
  let old_prefix = format!("{old}.");
  let children: Vec<(String, PathEntry)> = table
    .iter()
    .filter(|(p, _)| p.starts_with(&old_prefix))
    .map(|(p, e)| (p.clone(), e.clone()))
    .collect();
  for (p, mut e) in children {
    table.remove(&p);
    let new_path = format!("{new}{}", &p[old.len()..]);
    e.path = new_path.clone();
    table.insert(new_path, e);
  }
}

/// Remove a path and all its descendants from the table.
fn remove_subtree(table: &mut SymbolTable, path: &str) {
  let prefix = format!("{path}.");
  let keys: Vec<String> = table
    .keys()
    .filter(|p| *p == path || p.starts_with(&prefix))
    .cloned()
    .collect();
  for k in keys {
    table.remove(&k);
  }
}

/// Known type conversions (stringly-typed whitelist).
fn is_convertible(from: &str, to: &str) -> bool {
  const NUMERIC: &[&str] = &["i32", "i64", "u32", "u64", "f32", "f64", "usize", "isize"];
  if from == to {
    return true;
  }
  if NUMERIC.contains(&from) && NUMERIC.contains(&to) {
    return true;
  }
  if from == "String" && NUMERIC.contains(&to) {
    return true;
  }
  matches!((from, to), ("bool", "String") | ("String", "bool"))
}

// ---------------------------------------------------------------------------
// Codegen
// ---------------------------------------------------------------------------

/// Detect whether the user already manages derives on a declaration via
/// `#[structstruck::each[...]]`, the deprecated `#[strikethrough[...]]`, or a
/// plain `#[derive(...)]`. If so we must NOT inject our own `each` (two `each`s
/// would both apply their derives -> duplicate `derive` impls).
fn has_user_each(schema_tokens: &TS2) -> bool {
  fn scan(ts: &TS2) -> bool {
    let toks: Vec<TokenTree> = ts.clone().into_iter().collect();
    for w in toks.windows(4) {
      if let (TokenTree::Ident(i), TokenTree::Punct(a), TokenTree::Punct(b), TokenTree::Ident(e)) =
        (&w[0], &w[1], &w[2], &w[3])
        && i == "structstruck"
        && a.as_char() == ':'
        && b.as_char() == ':'
        && (e == "each" || e == "strikethrough")
      {
        return true;
      }
    }
    for tt in &toks {
      match tt {
        TokenTree::Ident(i) if i == "strikethrough" || i == "each" || i == "derive" => return true,
        TokenTree::Group(g) if scan(&g.stream()) => return true,
        _ => {}
      }
    }
    false
  }
  scan(schema_tokens)
}

/// Inject `#[structstruck::each[derive(...)]]` before every top-level
/// `struct`/`enum` keyword in the raw schema tokens, so structstruck applies
/// serde derives to all generated types. Skipped if the user manages derives
/// themselves via `structstruck::each`.
fn inject_each(schema_tokens: TS2) -> TS2 {
  let toks: Vec<TokenTree> = schema_tokens.into_iter().collect();
  let inject = !has_user_each(&toks.clone().into_iter().collect::<TS2>());
  let each = each_attr();
  let mut out = TS2::new();
  let mut depth = 0u32;
  let mut i = 0usize;
  while i < toks.len() {
    match &toks[i] {
      TokenTree::Group(_) => {
        depth += 1;
        out.extend([toks[i].clone()]);
        depth -= 1;
        i += 1;
      }
      TokenTree::Punct(p) if depth == 0 && p.as_char() == '#' => {
        // `#[aux]` is a DSL marker, not a Rust attribute: drop it so it
        // isn't forwarded to structstruck (Rust would reject the unknown attr).
        if i + 1 < toks.len() && is_aux_attr(&toks[i + 1]) {
          i += 2;
          continue;
        }
        out.extend([toks[i].clone()]);
        i += 1;
      }
      TokenTree::Ident(id) => {
        let s = id.to_string();
        if inject && depth == 0 && (s == "struct" || s == "enum") {
          out.extend(each.clone());
        }
        out.extend([TokenTree::Ident(id.clone())]);
        i += 1;
      }
      other => {
        out.extend([other.clone()]);
        i += 1;
      }
    }
  }
  out
}

/// Split the raw schema tokens into per-top-level-declaration token streams.
///
/// `structstruck::strike!` only processes the FIRST top-level declaration
/// (`lib.rs` calls `recurse_through_definition` once), so each top-level
/// `struct`/`enum` (with its leading attributes/visibility) must go through its
/// own `strike!` call.
///
/// A declaration runs from a top-level `struct`/`enum` keyword (plus its
/// leading preamble: `#[aux]`, `pub`, ...) through its `{ ... }` body. Anything
/// after the body is the preamble of the NEXT declaration.
fn split_top_levels(schema_tokens: &TS2) -> Vec<TS2> {
  let toks: Vec<TokenTree> = schema_tokens.clone().into_iter().collect();
  let mut decls: Vec<TS2> = Vec::new();
  let mut pending: Vec<TokenTree> = Vec::new();
  let mut cur: Vec<TokenTree> = Vec::new();
  let mut in_decl = false;
  let mut i = 0usize;
  while i < toks.len() {
    let tt = &toks[i];
    if !in_decl {
      if let TokenTree::Ident(id) = tt {
        if id == "struct" || id == "enum" {
          if !cur.is_empty() {
            decls.push(cur.drain(..).collect());
          }
          cur.append(&mut pending);
          cur.push(tt.clone());
          in_decl = true;
          i += 1;
          continue;
        }
      }
      pending.push(tt.clone());
    } else {
      cur.push(tt.clone());
      // The `{ ... }` body closes the declaration; afterwards the stream
      // belongs to the next declaration's preamble.
      if matches!(tt, TokenTree::Group(g) if g.delimiter() == proc_macro2::Delimiter::Brace) {
        in_decl = false;
      }
    }
    i += 1;
  }
  if !cur.is_empty() {
    decls.push(cur.into_iter().collect());
  }
  decls
}

/// The serde derive `each` attribute we inject for generated types.
fn each_attr() -> TS2 {
  quote!(
      #[structstruck::each[derive(::serde::Serialize, ::serde::Deserialize, Clone, Debug)]]
  )
}

/// `#[aux]` appears as a bracket group whose first token is `aux`.
fn is_aux_attr(tt: &TokenTree) -> bool {
  let TokenTree::Group(g) = tt else {
    return false;
  };
  if g.delimiter() != proc_macro2::Delimiter::Bracket {
    return false;
  }
  matches!(
      g.stream().into_iter().next(),
      Some(TokenTree::Ident(i)) if i == "aux"
  )
}

fn op_to_tokens(op: &Op, convert_fields: &[ConvertField]) -> TS2 {
  match op {
    // Model-level ops translate to runtime ops (schema change = runtime change).
    Op::AddModel { .. } => {
      // No runtime effect: the model's fields are introduced via
      // `convert` ops with defaults.
      quote! {}
    }
    Op::RemoveModel { name } => {
      quote! { ::sjmcl_migration::Op::Remove { path: #name.into() } }
    }
    Op::RenameModel { from, to } => {
      quote! { ::sjmcl_migration::Op::Rename { from: #from.into(), to: #to.into() } }
    }
    Op::Rename { from, to } => {
      quote! { ::sjmcl_migration::Op::Rename { from: #from.into(), to: #to.into() } }
    }
    Op::Move { from, to } => {
      quote! { ::sjmcl_migration::Op::Move { from: #from.into(), to: #to.into() } }
    }
    Op::Convert {
      path,
      from_ty,
      to_ty,
      default,
      f,
    } => {
      let from_ty_ts = from_ty
        .as_ref()
        .map(|t| quote! { Some(#t.into()) })
        .unwrap_or(quote! { None });
      let to_ty_ts = to_ty
        .as_ref()
        .map(|t| quote! { Some(#t.into()) })
        .unwrap_or(quote! { None });
      let default_ts = default
        .as_ref()
        .map(|v| quote! { Some(::serde_json::json!(#v)) })
        .unwrap_or(quote! { None });
      // Helper resolution: explicit `=> fn` wins; otherwise fall back to
      // the model-level `convert_field` registration for this path.
      let f_ts = f
        .as_ref()
        .map(|fn_path| quote! { Some(#fn_path) })
        .or_else(|| {
          convert_fields.iter().find(|cf| cf.path == *path).map(|cf| {
            let fn_path = &cf.f;
            quote! { Some(#fn_path) }
          })
        })
        .unwrap_or(quote! { None });
      quote! {
          ::sjmcl_migration::Op::Convert {
              path: #path.into(),
              from_ty: #from_ty_ts,
              to_ty: #to_ty_ts,
              default: #default_ts,
              f: #f_ts,
          }
      }
    }
    Op::Remove { path } => {
      quote! { ::sjmcl_migration::Op::Remove { path: #path.into() } }
    }
  }
}

fn codegen(
  final_schema_tokens: &TS2,
  migrations: &[Migration],
  root_ident: &Ident,
  max_version: Version,
  convert_fields: &[ConvertField],
) -> TS2 {
  // `strike!` only processes the first top-level declaration, so each top-level
  // struct/enum (root + every `#[aux]`) gets its own `strike!` call.
  let baseline_strikes: Vec<TS2> = split_top_levels(final_schema_tokens)
    .into_iter()
    .map(|decl| {
      let injected = inject_each(decl);
      quote! {
          ::structstruck::strike! { #injected }
      }
    })
    .collect();

  // Models introduced via `add_model` are also generated (their attributes
  // apply to the real type).
  let added_strikes: Vec<TS2> = migrations
    .iter()
    .flat_map(|m| m.ops.iter())
    .filter_map(|op| match op {
      Op::AddModel { raw, .. } => Some(raw.clone()),
      _ => None,
    })
    .map(|raw| {
      let injected = inject_each(raw);
      quote! {
          ::structstruck::strike! { #injected }
      }
    })
    .collect();

  let mig_descs: Vec<_> = migrations
    .iter()
    .map(|m| {
      let from = m.from.to_tokens();
      let to = m.to.to_tokens();
      // Model-level ops may translate to no runtime op (AddModel); drop
      // empty entries so `vec![...]` stays well-formed.
      let ops: Vec<_> = m
        .ops
        .iter()
        .map(|op| op_to_tokens(op, convert_fields))
        .filter(|t| !t.is_empty())
        .collect();
      quote! {
          ::sjmcl_migration::Migration {
              from: #from,
              to: #to,
              ops: vec![ #(#ops,)* ],
          }
      }
    })
    .collect();

  let max_version_ts = max_version.to_tokens();
  quote! {
      /// Real Rust types generated by structstruck from the schema block
      /// (one `strike!` per top-level declaration), plus every `add_model`.
      #(#baseline_strikes)*
      #(#added_strikes)*

      /// The settings root type (first declared struct).
      pub type SettingsRoot = #root_ident;

      /// Statically registered migration set (lazily built).
      pub static MIGRATIONS: std::sync::LazyLock<Vec<::sjmcl_migration::Migration>> =
          std::sync::LazyLock::new(|| vec![ #(#mig_descs,)* ]);

      pub mod __migration_meta {
          pub const MAX_VERSION: ::sjmcl_migration::Version = #max_version_ts;
      }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

pub fn migrations_impl(input: TokenStream) -> TokenStream {
  let input = parse_macro_input!(input as MigrationsInput);

  let (schemas, migrations) = (input.schemas, input.migrations);

  match validate(&schemas, &migrations) {
    Ok(_) => {}
    Err(errors) => {
      let errs: Vec<_> = errors.into_iter().map(|e| e.to_compile_error()).collect();
      return quote! { #(#errs)* }.into();
    }
  }

  // The highest declared version is the final schema (used to generate types).
  let final_block = schemas
    .iter()
    .max_by_key(|s| s.version)
    .expect("at least one schema block");
  let root_ident = final_block
    .roots
    .iter()
    .find_map(|i| match i {
      ItemDef::Struct(s) => Some(s.name.clone()),
      ItemDef::Enum(_) => None,
    })
    .unwrap_or_else(|| Ident::new("SettingsRoot", Span::call_site()));
  let max_version = migrations.iter().map(|m| m.to).max().unwrap_or(Version {
    major: 1,
    minor: 0,
    patch: 0,
  });

  let output = codegen(
    &final_block.raw_tokens,
    &migrations,
    &root_ident,
    max_version,
    &final_block.convert_fields,
  );
  output.into()
}
