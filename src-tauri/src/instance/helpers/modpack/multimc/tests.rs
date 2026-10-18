use serde_json::{Value, json};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri_plugin_http::reqwest;
use zip::{ZipWriter, write::SimpleFileOptions};

use crate::instance::helpers::client_json::{FeaturesInfo, McClientInfo};
use crate::instance::helpers::modpack::import::{ModpackManifest, extract_overrides};
use crate::instance::helpers::modpack::multimc::patch::{assemble_client, resolve_components};
use crate::instance::helpers::modpack::multimc::{MultiMcManifest, apply_instance_config};
use crate::instance::models::misc::ModLoaderType;
use crate::launch::helpers::file_validator::{
  get_invalid_library_files, get_nonnative_library_paths,
};
use crate::launcher_config::models::GameConfig;
use crate::resource::models::SourceType;

struct TestPack {
  root: PathBuf,
  file: File,
}

impl TestPack {
  fn new(components: Value, patches: &[(&str, Value)], cfg: &str) -> Self {
    let root = std::env::temp_dir().join(format!("sjmcl-mmc-test-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    let path = root.join("pack.zip");
    let mut zip = ZipWriter::new(File::create(&path).unwrap());
    let mut add = |name: &str, contents: &[u8]| {
      zip
        .start_file(format!("pack/{name}"), SimpleFileOptions::default())
        .unwrap();
      zip.write_all(contents).unwrap();
    };
    add(
      "mmc-pack.json",
      json!({"formatVersion":1, "components":components})
        .to_string()
        .as_bytes(),
    );
    add("instance.cfg", cfg.as_bytes());
    for (uid, patch) in patches {
      add(&format!("patches/{uid}.json"), patch.to_string().as_bytes());
    }
    add("libraries/custom.jar", b"local library");
    add("libraries/client.jar", b"local client");
    add("minecraft/config/test.cfg", b"imported config");
    zip.finish().unwrap();
    Self {
      root,
      file: File::open(path).unwrap(),
    }
  }
}

impl Drop for TestPack {
  fn drop(&mut self) {
    let _ = fs::remove_dir_all(&self.root);
  }
}

fn minecraft() -> Value {
  json!({
    "formatVersion":1, "uid":"net.minecraft", "version":"1.7.10",
    "mainClass":"net.minecraft.client.main.Main", "type":"release",
    "minecraftArguments":"--username ${auth_player_name} --version ${version_name}",
    "assetIndex":{"id":"1.7.10", "url":"https://example.com/assets.json"},
    "mainJar":{"name":"com.mojang:minecraft:1.7.10:client", "MMC-hint":"local", "MMC-filename":"client.jar"},
    "libraries":[{"name":"example:shared:1.0"}, {"name":"example:vanilla:1.0"}]
  })
}

#[tokio::test]
async fn custom_components_preserve_launch_configuration() {
  let pack = TestPack::new(
    json!([
      {"uid":"early", "version":"1"},
      {"uid":"net.minecraft", "version":"1.7.10"},
      {"uid":"custom", "version":"1"}
    ]),
    &[
      (
        "early",
        json!({"formatVersion":1,"uid":"early","version":"1", "requires":[{"uid":"net.minecraft","equals":"1.7.10"}], "libraries":[{"name":"example:early:1"}]}),
      ),
      ("net.minecraft", minecraft()),
      (
        "custom",
        json!({
          "formatVersion":1,"uid":"custom","version":"1", "mainClass":"example.Bootstrap",
          "compatibleJavaMajors":[17,21], "+jvmArgs":["-Djava.system.class.loader=example.Loader", "-Dmessage=hello world"],
          "+tweakers":["example.Tweaker"], "+traits":["FirstThreadOnMacOS"],
          "+libraries":[{"name":"example:shared:2.0"},{"name":"example:local:1", "MMC-hint":"local", "MMC-filename":"custom.jar"}],
          "mavenFiles":[{"name":"example:installer:1", "MMC-absoluteUrl":"https://example.com/installer.jar"}]
        }),
      ),
    ],
    "name=Custom\nOverrideJavaArgs=true\nJvmArgs=-Dtest=enabled\nOverrideMemory=true\nMinMemAlloc=1024\nMaxMemAlloc=6144\n",
  );
  let manifest = MultiMcManifest::from_archive(&pack.file).unwrap();
  let patches = resolve_components(&manifest, &pack.file, &reqwest::Client::new())
    .await
    .unwrap();
  assert_eq!(
    patches
      .iter()
      .map(|patch| patch.uid.as_str())
      .collect::<Vec<_>>(),
    ["early", "net.minecraft", "custom"]
  );
  let libraries = pack.root.join("libraries");
  let instance = pack.root.join("instance");
  let (info, compatible) = assemble_client(
    patches,
    &pack.file,
    &manifest.base_path,
    &libraries,
    &instance,
    "test",
  )
  .unwrap();
  assert_eq!(compatible, [17, 21]);
  assert_eq!(info.main_class.as_deref(), Some("example.Bootstrap"));
  assert_eq!(info.client_version.as_deref(), Some("1.7.10"));
  assert!(info.patches.is_empty());
  let saved = serde_json::to_vec(&info).unwrap();
  let restored: McClientInfo = serde_json::from_slice(&saved).unwrap();
  let classpath =
    get_nonnative_library_paths(&restored, &libraries, ModLoaderType::Unknown).unwrap();
  assert_eq!(classpath[0], libraries.join("example/early/1/early-1.jar"));
  assert_eq!(
    classpath[1],
    libraries.join("example/shared/2.0/shared-2.0.jar")
  );
  assert_eq!(classpath.len(), 4);
  assert_eq!(fs::read(&classpath[3]).unwrap(), b"local library");
  assert_eq!(
    fs::read(instance.join("test.jar")).unwrap(),
    b"local client"
  );
  let args = restored.arguments.as_ref().unwrap();
  let jvm = args.to_jvm_arguments(&FeaturesInfo::default()).unwrap();
  assert!(jvm.contains(&"-Dmessage=hello world".to_string()));
  assert_eq!(
    jvm.contains(&"-XstartOnFirstThread".to_string()),
    cfg!(target_os = "macos")
  );
  assert!(
    args
      .to_game_arguments(&FeaturesInfo::default())
      .unwrap()
      .ends_with(&["--tweakClass".to_string(), "example.Tweaker".to_string()])
  );
  let mut config = GameConfig::default();
  apply_instance_config(&manifest.cfg, &mut config).unwrap();
  assert_eq!(config.performance.max_mem_allocation, 6144);
  assert!(!config.performance.auto_mem_allocation);
  assert_eq!(config.advanced.jvm.args, "-Dtest=enabled -Xms1024m");
  extract_overrides(&pack.file, &instance, &manifest.get_overrides_path()).unwrap();
  assert_eq!(
    fs::read(instance.join("config/test.cfg")).unwrap(),
    b"imported config"
  );
}

#[tokio::test]
async fn dependencies_are_inserted_without_reordering_explicit_components() {
  let pack = TestPack::new(
    json!([{ "uid":"net.minecraft" }, {"uid":"custom", "version":"1"}]),
    &[
      ("net.minecraft", minecraft()),
      (
        "custom",
        json!({"formatVersion":1,"uid":"custom","version":"1", "requires":[{"uid":"dependency","equals":"2"}]}),
      ),
      (
        "dependency",
        json!({"formatVersion":1,"uid":"dependency","version":"2"}),
      ),
    ],
    "name=Dependency test\n",
  );
  let manifest = MultiMcManifest::from_archive(&pack.file).unwrap();
  assert_eq!(manifest.get_client_version().unwrap(), "1.7.10");
  let patches = resolve_components(&manifest, &pack.file, &reqwest::Client::new())
    .await
    .unwrap();
  assert_eq!(
    patches
      .iter()
      .map(|patch| patch.uid.as_str())
      .collect::<Vec<_>>(),
    ["net.minecraft", "dependency", "custom"]
  );
}

#[tokio::test]
async fn conflicting_component_versions_are_rejected() {
  let pack = TestPack::new(
    json!([{"uid":"net.minecraft","version":"1.7.10"},{"uid":"custom","version":"1"}]),
    &[
      ("net.minecraft", minecraft()),
      (
        "custom",
        json!({"formatVersion":1,"uid":"custom","version":"1", "requires":[{"uid":"net.minecraft","equals":"1.12.2"}]}),
      ),
    ],
    "name=Conflict\n",
  );
  let manifest = MultiMcManifest::from_archive(&pack.file).unwrap();
  let err = resolve_components(&manifest, &pack.file, &reqwest::Client::new())
    .await
    .unwrap_err();
  assert!(err.0.contains("Unsatisfied MMC dependency"));
}

#[tokio::test]
async fn unhashed_maven_files_are_downloaded_without_entering_classpath() {
  let info: McClientInfo = serde_json::from_value(json!({"mavenFiles":[{"name":"example:installer:1","downloads":{"artifact":{"path":"installer.jar","url":"https://example.com/installer.jar"}}}]})).unwrap();
  let root = Path::new("/nonexistent/sjmcl-mmc-test");
  let params = get_invalid_library_files(SourceType::Official, root, &info, true)
    .await
    .unwrap();
  assert_eq!(params.len(), 1);
  let crate::tasks::PTaskParam::Download(param) = &params[0];
  assert!(param.sha1.is_none());
  assert!(
    get_nonnative_library_paths(&info, root, ModLoaderType::Unknown)
      .unwrap()
      .is_empty()
  );
}

#[test]
fn java_selection_uses_membership_instead_of_a_minimum() {
  use crate::instance::helpers::modpack::multimc::{
    downloadable_java_major, select_compatible_java,
  };
  use crate::launcher_config::models::JavaInfo;
  let javas: Vec<_> = [8, 19, 21, 25]
    .into_iter()
    .map(|major_version| JavaInfo {
      major_version,
      ..Default::default()
    })
    .collect();
  assert_eq!(
    select_compatible_java(&javas, &[17, 21])
      .unwrap()
      .major_version,
    21
  );
  assert!(select_compatible_java(&javas, &[17]).is_none());
  assert_eq!(downloadable_java_major(&[17, 21]), Some(21));
  assert_eq!(downloadable_java_major(&[11, 19]), None);
}

#[test]
fn library_rules_apply_the_last_matching_platform_rule() {
  use crate::instance::helpers::client_json::{IsAllowed, LibrariesValue};
  let os = tauri_plugin_os::type_().to_string();
  let other_os = if os == "windows" { "linux" } else { "windows" };
  let lib: LibrariesValue = serde_json::from_value(json!({
    "name":"example:native:1", "rules":[
      {"action":"allow", "os":{"name":other_os}},
      {"action":"allow", "os":{"name":os}}
    ]
  }))
  .unwrap();
  assert!(lib.is_allowed(&FeaturesInfo::default()).unwrap());
  let blocked: LibrariesValue = serde_json::from_value(json!({
    "name":"example:native:1", "rules":[
      {"action":"allow", "os":{"name":os}},
      {"action":"disallow", "os":{"name":os}}
    ]
  }))
  .unwrap();
  assert!(!blocked.is_allowed(&FeaturesInfo::default()).unwrap());
}

#[tokio::test]
async fn native_classifiers_and_explicit_artifact_paths_are_preserved() {
  use crate::launch::helpers::file_validator::{
    get_native_library_artifacts, get_native_library_paths,
  };
  let os = if cfg!(target_os = "macos") {
    "osx"
  } else if cfg!(target_os = "windows") {
    "windows"
  } else {
    "linux"
  };
  let pack = TestPack::new(
    json!([{"uid":"net.minecraft","version":"1.7.10"}]),
    &[("net.minecraft", {
      let mut patch = minecraft();
      patch["libraries"] = json!([{
        "name":"example:native:1", "natives":{os:"natives-test"},
        "downloads":{"classifiers":{"natives-test":{"path":"custom/native.jar", "url":"https://example.com/native.jar"}}}
      }]);
      patch
    })],
    "name=Native test\n",
  );
  let manifest = MultiMcManifest::from_archive(&pack.file).unwrap();
  let patches = resolve_components(&manifest, &pack.file, &reqwest::Client::new())
    .await
    .unwrap();
  let libraries = pack.root.join("libraries");
  let (info, _) = assemble_client(
    patches,
    &pack.file,
    &manifest.base_path,
    &libraries,
    &pack.root.join("instance"),
    "test",
  )
  .unwrap();
  assert!(
    get_nonnative_library_paths(&info, &libraries, ModLoaderType::Unknown)
      .unwrap()
      .is_empty()
  );
  assert_eq!(
    get_native_library_artifacts(&info)[0].path,
    "custom/native.jar"
  );
  assert_eq!(
    get_native_library_paths(&info, &libraries, false, false).unwrap(),
    [libraries.join("custom/native.jar")]
  );
}

#[tokio::test]
async fn forge_wrapper_receives_installer_paths_without_installing_another_loader() {
  let pack = TestPack::new(
    json!([{"uid":"net.minecraft","version":"1.7.10"},{"uid":"net.minecraftforge","version":"1"}]),
    &[
      ("net.minecraft", minecraft()),
      (
        "net.minecraftforge",
        json!({
          "formatVersion":1,"uid":"net.minecraftforge","version":"1", "mainClass":"io.github.zekerzhayard.forgewrapper.installer.Main",
          "libraries":[{"name":"io.github.zekerzhayard:ForgeWrapper:1.6.0"}],
          "mavenFiles":[{"name":"net.minecraftforge:forge:1.20.1-47.0.0:installer", "url":"https://maven.minecraftforge.net/"}]
        }),
      ),
    ],
    "name=Forge\nOverrideJavaArgs=false\nJvmArgs=-Dignored=true\nOverrideMemory=false\nMaxMemAlloc=6144\n",
  );
  let manifest = MultiMcManifest::from_archive(&pack.file).unwrap();
  let patches = resolve_components(&manifest, &pack.file, &reqwest::Client::new())
    .await
    .unwrap();
  let (info, compatible) = assemble_client(
    patches,
    &pack.file,
    &manifest.base_path,
    &pack.root.join("libraries"),
    &pack.root.join("instance"),
    "test",
  )
  .unwrap();
  assert!(compatible.is_empty());
  let jvm = info
    .arguments
    .unwrap()
    .to_jvm_arguments(&FeaturesInfo::default())
    .unwrap();
  assert!(jvm.contains(&"-Dforgewrapper.minecraft=${primary_jar}".to_string()));
  assert!(jvm.contains(&"-Dforgewrapper.installer=${library_directory}/net/minecraftforge/forge/1.20.1-47.0.0/forge-1.20.1-47.0.0-installer.jar".to_string()));
  let mut config = GameConfig::default();
  apply_instance_config(&manifest.cfg, &mut config).unwrap();
  assert!(config.advanced.jvm.args.is_empty());
  assert!(config.performance.auto_mem_allocation);
}
