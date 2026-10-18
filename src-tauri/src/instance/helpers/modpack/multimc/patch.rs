use futures::future::try_join_all;
use serde::Deserialize;
use sha1::{Digest, Sha1};
use sjmcl_types::error::{SJMCLError, SJMCLResult};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use tauri_plugin_http::reqwest;
use zip::ZipArchive;

use crate::instance::helpers::client_json::{
  ArgumentsItem, AssetIndexInfo, DownloadsValue, FeaturesInfo, InstructionRule, IsAllowed,
  LaunchArgumentTemplate, LibrariesValue, McClientInfo, OsInfo,
};
use crate::instance::helpers::modpack::multimc::{MultiMcManifest, get_version};
use crate::launch::helpers::file_validator::convert_library_name_to_path;
use crate::launch::helpers::misc::get_natives_string;
use crate::utils::fs::normalize_relative_path;

const META_URL: &str = "https://meta.prismlauncher.org/v1/";

#[derive(Debug, Default, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct ComponentRequirement {
  uid: String,
  equals: Option<String>,
  suggests: Option<String>,
}

#[derive(Debug, Default, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct ComponentPatch {
  #[serde(alias = "fileId")]
  pub uid: String,
  pub version: String,
  format_version: u64,
  main_class: Option<String>,
  main_jar: Option<ComponentLibrary>,
  minecraft_arguments: Option<String>,
  #[serde(rename = "+jvmArgs")]
  jvm_args: Vec<String>,
  #[serde(rename = "+tweakers")]
  tweakers: Vec<String>,
  #[serde(rename = "+traits")]
  traits: Vec<String>,
  compatible_java_majors: Vec<i32>,
  asset_index: Option<AssetIndexInfo>,
  #[serde(rename = "type")]
  type_: String,
  libraries: Vec<ComponentLibrary>,
  #[serde(rename = "+libraries")]
  additional_libraries: Vec<ComponentLibrary>,
  maven_files: Vec<ComponentLibrary>,
  requires: Vec<ComponentRequirement>,
  conflicts: Vec<ComponentRequirement>,
  #[serde(alias = "+jarMods")]
  jar_mods: Vec<ComponentLibrary>,
}

#[derive(Debug, Default, Deserialize, Clone)]
#[serde(default)]
struct ComponentLibrary {
  #[serde(flatten)]
  library: LibrariesValue,
  url: Option<String>,
  #[serde(rename = "MMC-absoluteUrl", alias = "MMC-absulute_url")]
  absolute_url: Option<String>,
  #[serde(rename = "MMC-hint")]
  hint: String,
  #[serde(rename = "MMC-filename")]
  filename: Option<String>,
}

pub fn read_local_patch(
  archive: &mut ZipArchive<&File>,
  base_path: &str,
  uid: &str,
) -> SJMCLResult<Option<ComponentPatch>> {
  match archive.by_name(&format!("{base_path}patches/{uid}.json")) {
    Ok(file) => Ok(Some(serde_json::from_reader(file)?)),
    Err(zip::result::ZipError::FileNotFound) => Ok(None),
    Err(err) => Err(err.into()),
  }
}

async fn load_patch(
  file: &File,
  client: &reqwest::Client,
  base_path: &str,
  uid: &str,
  version: Option<&str>,
) -> SJMCLResult<ComponentPatch> {
  let patch = if let Some(patch) = read_local_patch(&mut ZipArchive::new(file)?, base_path, uid)? {
    patch
  } else {
    let version = match version {
      Some(version) => version.to_string(),
      None => {
        #[derive(Deserialize)]
        struct Index {
          versions: Vec<IndexVersion>,
        }
        #[derive(Deserialize)]
        struct IndexVersion {
          version: String,
          #[serde(default)]
          recommended: bool,
        }
        let index = client
          .get(format!("{META_URL}{uid}/index.json"))
          .send()
          .await?
          .error_for_status()?
          .json::<Index>()
          .await?;
        index
          .versions
          .iter()
          .find(|entry| entry.recommended)
          .or(index.versions.first())
          .ok_or_else(|| SJMCLError(format!("No MMC component versions: {uid}")))?
          .version
          .clone()
      }
    };
    client
      .get(format!("{META_URL}{uid}/{version}.json"))
      .send()
      .await?
      .error_for_status()?
      .json::<ComponentPatch>()
      .await?
  };
  if patch.format_version > 1 || patch.uid != uid {
    return Err(SJMCLError(format!("Invalid MMC component: {uid}")));
  }
  Ok(patch)
}

pub async fn resolve_components(
  manifest: &MultiMcManifest,
  file: &File,
  client: &reqwest::Client,
) -> SJMCLResult<Vec<ComponentPatch>> {
  let mut patches = try_join_all(manifest.components.iter().map(|component| async move {
    load_patch(
      file,
      client,
      &manifest.base_path,
      &component.uid,
      get_version(component).ok().as_deref(),
    )
    .await
  }))
  .await?;

  // Preserve explicit component order; only missing dependencies are inserted before their users.
  let mut index = 0;
  while index < patches.len() {
    let missing = patches[index]
      .requires
      .iter()
      .find(|requirement| !patches.iter().any(|patch| patch.uid == requirement.uid))
      .cloned();
    if let Some(requirement) = missing {
      let exact = patches
        .iter()
        .flat_map(|patch| &patch.requires)
        .find_map(|other| {
          (other.uid == requirement.uid)
            .then_some(other.equals.as_deref())
            .flatten()
        });
      let patch = load_patch(
        file,
        client,
        &manifest.base_path,
        &requirement.uid,
        exact.or(requirement.suggests.as_deref()),
      )
      .await?;
      patches.insert(index, patch);
    } else {
      index += 1;
    }
  }
  validate_components(&patches)?;
  Ok(patches)
}

fn validate_components(patches: &[ComponentPatch]) -> SJMCLResult<()> {
  let versions: HashMap<_, _> = patches
    .iter()
    .map(|patch| (&patch.uid, &patch.version))
    .collect();
  for patch in patches {
    for requirement in &patch.requires {
      let version = versions.get(&requirement.uid);
      if version.is_none()
        || requirement
          .equals
          .as_ref()
          .is_some_and(|expected| version != Some(&expected))
      {
        return Err(SJMCLError(format!(
          "Unsatisfied MMC dependency: {} requires {} {:?}",
          patch.uid, requirement.uid, requirement.equals
        )));
      }
    }
    for conflict in &patch.conflicts {
      if let Some(version) = versions.get(&conflict.uid)
        && conflict
          .equals
          .as_ref()
          .is_none_or(|expected| version == &expected)
      {
        return Err(SJMCLError(format!(
          "Conflicting MMC components: {} and {}",
          patch.uid, conflict.uid
        )));
      }
    }
  }
  Ok(())
}

impl ComponentLibrary {
  fn convert(
    mut self,
    archive: &mut ZipArchive<&File>,
    base_path: &str,
    libraries_dir: &Path,
  ) -> SJMCLResult<LibrariesValue> {
    for rule in &mut self.library.rules {
      if let Some(os) = &mut rule.os
        && let Some((name, arch)) = os.name.clone().split_once('-')
      {
        os.name = name.to_string();
        os.arch = Some(if arch == "arm64" { "aarch64" } else { arch }.to_string());
      }
    }
    let native = self.library.natives.as_ref().and_then(get_natives_string);
    let active = self.library.is_allowed(&FeaturesInfo::default())?
      && (self.library.natives.is_none() || native.is_some());
    let name = &self.library.name;
    let downloads = self.library.downloads.get_or_insert_with(Default::default);
    if self.library.natives.is_none() {
      downloads.artifact.get_or_insert_with(Default::default);
    } else {
      let classifiers = downloads.classifiers.get_or_insert_with(Default::default);
      for native in self.library.natives.as_ref().unwrap().values() {
        for arch in ["32", "64"] {
          classifiers
            .entry(native.replace("${arch}", arch))
            .or_default();
        }
      }
    }
    let artifacts = downloads
      .artifact
      .iter_mut()
      .map(|artifact| (None, artifact))
      .chain(downloads.classifiers.iter_mut().flat_map(|classifiers| {
        classifiers
          .iter_mut()
          .map(|(classifier, artifact)| (Some(classifier.clone()), artifact))
      }));
    for (classifier, artifact) in artifacts {
      if artifact.path.is_empty() {
        artifact.path = convert_library_name_to_path(name, classifier.clone())?;
      }
      if let Some(filename) = &self.filename {
        artifact.path = Path::new(&artifact.path)
          .with_file_name(filename)
          .to_string_lossy()
          .into_owned();
      }
      normalize_relative_path(Path::new(&artifact.path))?;
      if self.hint == "local" {
        artifact.url.clear();
        if !active || classifier != native {
          continue;
        }
        let filename = Path::new(&artifact.path)
          .file_name()
          .unwrap()
          .to_string_lossy()
          .into_owned();
        let mut file = archive.by_name(&format!("{base_path}libraries/{filename}"))?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)?;
        artifact.sha1 = hex::encode(Sha1::digest(&bytes));
        artifact.size = bytes.len() as i64;
        // Local libraries with identical Maven coordinates may differ between packs.
        artifact.path = format!("local/{}/{filename}", artifact.sha1);
        let dest = libraries_dir.join(&artifact.path);
        fs::create_dir_all(dest.parent().unwrap())?;
        fs::write(dest, bytes)?;
      } else if let Some(url) = &self.absolute_url {
        artifact.url = url.clone();
      } else if artifact.url.is_empty() {
        artifact.url = format!(
          "{}/{}",
          self
            .url
            .as_deref()
            .unwrap_or("https://libraries.minecraft.net")
            .trim_end_matches('/'),
          artifact.path
        );
      }
    }
    Ok(self.library)
  }
}

fn argument(value: impl Into<String>) -> ArgumentsItem {
  ArgumentsItem {
    value: vec![value.into()],
    ..Default::default()
  }
}

pub fn assemble_client(
  patches: Vec<ComponentPatch>,
  file: &File,
  base_path: &str,
  libraries_dir: &Path,
  instance_path: &Path,
  name: &str,
) -> SJMCLResult<(McClientInfo, Vec<i32>)> {
  let mut archive = ZipArchive::new(file)?;
  let mut result = McClientInfo {
    id: name.to_string(),
    jar: Some(name.to_string()),
    preserve_libraries: true,
    ..Default::default()
  };
  let mut arguments = LaunchArgumentTemplate {
    jvm: [
      "-Djava.library.path=${natives_directory}",
      "-Dminecraft.launcher.brand=${launcher_name}",
      "-Dminecraft.launcher.version=${launcher_version}",
    ]
    .into_iter()
    .map(argument)
    .collect(),
    ..Default::default()
  };
  let mut tweakers = Vec::new();
  let mut compatible_java_majors = Vec::new();
  let mut traits = HashSet::new();
  let mut main_jar = None;
  for patch in patches {
    if !patch.jar_mods.is_empty() {
      return Err(SJMCLError("MMC jarMods are not supported".to_string()));
    }
    if patch.uid == "net.minecraft" {
      result.client_version = Some(patch.version);
      if let Some(index) = patch.asset_index {
        result.assets = index.id.clone();
        result.asset_index = index;
      }
      result.type_ = patch.type_;
    }
    if let Some(class) = patch.main_class.filter(|class| !class.is_empty()) {
      result.main_class = Some(class);
    }
    if let Some(game_args) = patch.minecraft_arguments.filter(|args| !args.is_empty()) {
      arguments.game = shlex::split(&game_args)
        .ok_or_else(|| SJMCLError("Invalid MMC minecraftArguments".to_string()))?
        .into_iter()
        .map(argument)
        .collect();
    }
    arguments
      .jvm
      .extend(patch.jvm_args.into_iter().map(argument));
    tweakers.retain(|tweaker| !patch.tweakers.contains(tweaker));
    tweakers.extend(patch.tweakers);
    traits.extend(patch.traits);
    for major in patch.compatible_java_majors {
      if !compatible_java_majors.contains(&major) {
        compatible_java_majors.push(major);
      }
    }
    for library in patch
      .libraries
      .into_iter()
      .chain(patch.additional_libraries)
    {
      result
        .libraries
        .push(library.convert(&mut archive, base_path, libraries_dir)?);
    }
    for library in patch.maven_files {
      result
        .maven_files
        .push(library.convert(&mut archive, base_path, libraries_dir)?);
    }
    if patch.main_jar.is_some() {
      main_jar = patch.main_jar;
    }
  }
  for tweaker in tweakers {
    arguments
      .game
      .extend([argument("--tweakClass"), argument(tweaker)]);
  }
  if traits.contains("FirstThreadOnMacOS") {
    arguments.jvm.push(ArgumentsItem {
      value: vec!["-XstartOnFirstThread".to_string()],
      rules: vec![InstructionRule {
        action: "allow".to_string(),
        os: Some(OsInfo {
          name: "osx".to_string(),
          ..Default::default()
        }),
        ..Default::default()
      }],
    });
  }
  if traits.contains("legacyLaunch") {
    return Err(SJMCLError("MMC legacyLaunch is not supported".to_string()));
  }
  if result.libraries.iter().any(|library| {
    library
      .name
      .starts_with("io.github.zekerzhayard:ForgeWrapper:")
  }) {
    arguments.jvm.extend([
      argument("-Dforgewrapper.librariesDir=${library_directory}"),
      argument("-Dforgewrapper.minecraft=${primary_jar}"),
    ]);
    for library in result.libraries.iter().chain(&result.maven_files) {
      if (library.name.starts_with("net.minecraftforge:forge:")
        || library.name.starts_with("net.neoforged:neoforge:"))
        && library.name.ends_with(":installer")
      {
        let path = &library
          .downloads
          .as_ref()
          .unwrap()
          .artifact
          .as_ref()
          .unwrap()
          .path;
        arguments.jvm.push(argument(format!(
          "-Dforgewrapper.installer=${{library_directory}}/{path}"
        )));
      }
    }
  }
  let main_jar = main_jar
    .ok_or_else(|| SJMCLError("Missing MMC mainJar".to_string()))?
    .convert(&mut archive, base_path, libraries_dir)?;
  let artifact = main_jar
    .downloads
    .and_then(|downloads| downloads.artifact)
    .ok_or_else(|| SJMCLError("Missing MMC mainJar artifact".to_string()))?;
  if artifact.url.is_empty() {
    fs::create_dir_all(instance_path)?;
    fs::copy(
      libraries_dir.join(&artifact.path),
      instance_path.join(format!("{name}.jar")),
    )?;
  }
  result.downloads.insert(
    "client".to_string(),
    DownloadsValue {
      url: artifact.url,
      sha1: artifact.sha1,
      size: artifact.size,
    },
  );
  result.arguments = Some(arguments);
  Ok((result, compatible_java_majors))
}
