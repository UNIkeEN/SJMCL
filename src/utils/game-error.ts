/**
 * The following rules are adapted from Hello Minecraft! Launcher,
 * originally developed by huangyuhui <huanghongxun2008@126.com> and contributors.
 */
const crashRules: { key: string; pattern: RegExp }[] = [
  {
    key: "OPENJ9",
    pattern:
      /(Open J9 is not supported|OpenJ9 is incompatible|\.J9VMInternals\.)/,
  },
  {
    key: "NEED_JDK11",
    pattern:
      /(no such method: sun\.misc\.Unsafe\.defineAnonymousClass\(Class,byte\[\],Object\[\]\)Class\/invokeVirtual|java\.lang\.UnsupportedClassVersionError: icyllis\/modernui\/forge\/MixinConnector has been compiled by a more recent version of the Java Runtime \(class file version 55\.0\), this version of the Java Runtime only recognizes class file versions up to 52\.0|java\.lang\.IllegalArgumentException: The requested compatibility level JAVA_11 could not be set\. Level is not supported by the active JRE or ASM version)/,
  },
  {
    key: "TOO_OLD_JAVA",
    pattern: /java\.lang\.UnsupportedClassVersionError: (.*?) version (\d+)\.0/,
  },
  {
    key: "JVM_32BIT",
    pattern:
      /(Could not reserve enough space for (.*?)KB object heap|The specified size exceeds the maximum representable size|Invalid maximum heap size)/,
  },
  {
    key: "GL_OPERATION_FAILURE",
    pattern:
      /(1282: Invalid operation|Maybe try a lower resolution resourcepack\?)/,
  },
  {
    key: "OPENGL_NOT_SUPPORTED",
    pattern: /The driver does not appear to support OpenGL/,
  },
  {
    key: "GRAPHICS_DRIVER",
    pattern:
      /(Pixel format not accelerated|GLX: Failed to create context: GLXBadFBConfig|Couldn't set pixel format|net\.minecraftforge\.fml.client\.SplashProgress|org\.lwjgl\.LWJGLException|EXCEPTION_ACCESS_VIOLATION(.|\n|\r)+# C {2}\[(ig|atio|nvoglv))/,
  },
  {
    key: "MACOS_FAILED_TO_FIND_SERVICE_PORT_FOR_DISPLAY",
    pattern:
      /java\.lang\.IllegalStateException: GLFW error before init: \[0x10008\]Cocoa: Failed to find service port for display/,
  },
  {
    key: "OUT_OF_MEMORY",
    pattern:
      /(java\.lang\.OutOfMemoryError|The system is out of physical RAM or swap space|Out of Memory Error|Error occurred during initialization of VM\rToo small maximum heap)/,
  },
  {
    key: "MEMORY_EXCEEDED",
    pattern:
      /There is insufficient memory for the Java Runtime Environment to continue/,
  },
  {
    key: "RESOLUTION_TOO_HIGH",
    pattern:
      /Maybe try a (lower resolution|lowerresolution) (resourcepack|texturepack)\?/,
  },
  {
    key: "JDK_9",
    pattern: /java\.lang\.ClassCastException: (java\.base\/jdk|class jdk)/,
  },
  {
    key: "MAC_JDK_8U261",
    pattern:
      /Terminating app due to uncaught exception 'NSInternalInconsistencyException', reason: 'NSWindow drag regions should only be invalidated on the Main Thread!'/,
  },
  {
    key: "FILE_CHANGED",
    pattern:
      /java\.lang\.SecurityException: SHA1 digest error for (.*)|signer information does not match signer information of other classes in the same package/,
  },
  {
    key: "NO_SUCH_METHOD_ERROR",
    pattern: /java\.lang\.NoSuchMethodError: (.*?)/,
  },
  {
    key: "NO_CLASS_DEF_FOUND_ERROR",
    pattern: /java\.lang\.NoClassDefFoundError: (.*)/,
  },
  {
    key: "ILLEGAL_ACCESS_ERROR",
    pattern:
      /java\.lang\.IllegalAccessError: tried to access class (.*?) from class (.*?)/,
  },
  { key: "DUPLICATED_MOD", pattern: /Found a duplicate mod (.*) at (.*)/ },
  {
    key: "MOD_RESOLUTION",
    pattern: /ModResolutionException: ((.*)[\n\r]*( - (.*)[\n\r]*)+)/,
  },
  {
    key: "FORGEMOD_RESOLUTION",
    pattern:
      /Missing or unsupported mandatory dependencies:((.*)[\n\r]*(\t(.*)[\n\r]*)+)/,
  },
  {
    key: "FORGE_FOUND_DUPLICATE_MODS",
    pattern: /Found duplicate mods:((.*)\R*(\t(.*)\R*)+)/,
  },
  {
    key: "MOD_RESOLUTION_CONFLICT",
    pattern:
      /ModResolutionException: Found conflicting mods: (.*) conflicts with (.*)/,
  },
  {
    key: "MOD_RESOLUTION_MISSING",
    pattern:
      /ModResolutionException: Could not find required mod: (.*) requires (.*)/,
  },
  {
    key: "MOD_RESOLUTION_MISSING_MINECRAFT",
    pattern:
      /ModResolutionException: Could not find required mod: (.*) requires \{minecraft @ (.*)\}/,
  },
  {
    key: "MOD_RESOLUTION_COLLECTION",
    pattern:
      /ModResolutionException: Could not resolve valid mod collection \(at: (.*) requires (.*)\)/,
  },
  {
    key: "FILE_ALREADY_EXISTS",
    pattern: /java\.nio\.file\.FileAlreadyExistsException: (.*)/,
  },
  {
    key: "LOADING_CRASHED_FORGE",
    pattern: /LoaderExceptionModCrash: Caught exception from (.*?) \((.*)\)/,
  },
  {
    key: "BOOTSTRAP_FAILED",
    pattern: /Failed to create mod instance\. ModID: (.*?),/,
  },
  {
    key: "LOADING_CRASHED_FABRIC",
    pattern:
      /Could not execute entrypoint stage '(.*?)' due to errors, provided by '(.*)'!/,
  },
  {
    key: "FABRIC_VERSION_0_12",
    pattern:
      /java\.lang\.NoClassDefFoundError: org\/spongepowered\/asm\/mixin\/transformer\/FabricMixinTransformerProxy/,
  },
  {
    key: "MODLAUNCHER_8",
    pattern:
      /java\.lang\.NoSuchMethodError: ('void sun\.security\.util\.ManifestEntryVerifier\.<init>\(java\.util\.jar\.Manifest\)'|sun\.security\.util\.ManifestEntryVerifier\.<init>\(Ljava\/util\/jar\/Manifest;\)V)/,
  },
  { key: "DEBUG_CRASH", pattern: /Manually triggered debug crash/ },
  {
    key: "CONFIG",
    pattern: /Failed loading config file (.*?) of type (.*?) for modid (.*)/,
  },
  {
    key: "FABRIC_WARNINGS",
    pattern:
      /(Warnings were found!|Incompatible mod set!|which is missing!|that is compatible with|Incompatible mods found!)(.*?)[\n\r]+([^[]+)\[/,
  },
  {
    key: "ENTITY",
    pattern: /Entity Type: (.*)[\w\W\n\r]*?Entity's Exact location: (.*)/,
  },
  { key: "BLOCK", pattern: /Block: (.*)[\w\W\n\r]*?Block location: (.*)/ },
  {
    key: "UNSATISFIED_LINK_ERROR",
    pattern: /java\.lang\.UnsatisfiedLinkError: Failed to locate library: (.*)/,
  },
  {
    key: "OPTIFINE_IS_NOT_COMPATIBLE_WITH_FORGE",
    pattern:
      /(java\.lang\.NoSuchMethodError: 'java\.lang\.Class sun\.misc\.Unsafe\.defineAnonymousClass\(java\.lang\.Class, byte\[\], java\.lang\.Object\[\]\)'|java\.lang\.NoSuchMethodError: 'void net\.minecraft\.client\.renderer\.texture\.SpriteContents\.<init>\(net\.minecraft\.resources\.ResourceLocation, |java\.lang\.NoSuchMethodError: 'void net\.minecraftforge\.client\.gui\.overlay\.ForgeGui\.renderSelectedItemName\(net\.minecraft\.client\.gui\.GuiGraphics, int\)'|java\.lang\.NoSuchMethodError: 'java\.lang\.String com\.mojang\.blaze3d\.systems\.RenderSystem\.getBackendDescription\(\)'|java\.lang\.NoSuchMethodError: 'net\.minecraft\.network\.chat\.FormattedText net\.minecraft\.client\.gui\.Font\.ellipsize\(net\.minecraft\.network\.chat\.FormattedText, int\)'|java\.lang\.NoSuchMethodError: 'void net\.minecraft\.server\.level\.DistanceManager\.(.*?)\(net\.minecraft\.server\.level\.TicketType, net\.minecraft\.world\.level\.ChunkPos, int, java\.lang\.Object, boolean\)'|java\.lang\.NoSuchMethodError: 'void net\.minecraft\.client\.renderer\.block\.model\.BakedQuad\.<init>\(int\[\], int, net\.minecraft\.core\.Direction, net\.minecraft\.client\.renderer\.texture\.TextureAtlasSprite, boolean, boolean\)'|TRANSFORMER\/net\.optifine\/net\.optifine\.reflect\.Reflector\.<clinit>\(Reflector\.java\))/,
  },
  {
    key: "MOD_FILES_ARE_DECOMPRESSED",
    pattern:
      /(The directories below appear to be extracted jar files\. Fix this before you continue|Extracted mod jars found, loading will NOT continue)/,
  },
  {
    key: "OPTIFINE_CAUSES_THE_WORLD_TO_FAIL_TO_LOAD",
    pattern:
      /java\.lang\.NoSuchMethodError: net\.minecraft\.world\.server\.ChunkManager\$ProxyTicketManager\.shouldForceTicks\(J\)Z/,
  },
  {
    key: "TOO_MANY_MODS_LEAD_TO_EXCEEDING_THE_ID_LIMIT",
    pattern: /maximum id range exceeded/,
  },
  {
    key: "MODMIXIN_FAILURE",
    pattern:
      /(MixinApplyError|Mixin prepare failed |Mixin apply failed |mixin\.injection\.throwables\.|\.mixins\.json\] FAILED during \))/,
  },
  { key: "MIXIN_APPLY_MOD_FAILED", pattern: /Mixin apply for mod (.*) failed/ },
  {
    key: "FORGE_ERROR",
    pattern:
      /An exception was thrown, the game will display an error screen and halt\.\R*(.*\R*(\s*at .*\R)+)/,
  },
  {
    key: "MOD_RESOLUTION0",
    pattern: /(\tMod File:|-- MOD |\tFailure message:)/,
  },
  {
    key: "FORGE_REPEAT_INSTALLATION",
    pattern:
      /MultipleArgumentsForOptionException: Found multiple arguments for option (.*?), but you asked for only one/,
  },
  {
    key: "OPTIFINE_REPEAT_INSTALLATION",
    pattern:
      /ResolutionException: Module optifine reads another module named optifine/,
  },
  {
    key: "JAVA_VERSION_IS_TOO_HIGH",
    pattern:
      /(Unable to make protected final java\.lang\.Class java\.lang\.ClassLoader\.defineClass|java\.lang\.NoSuchFieldException: ucp|Unsupported class file major version|because module java\.base does not export|java\.lang\.ClassNotFoundException: jdk\.nashorn\.api\.scripting\.NashornScriptEngineFactory|java\.lang\.ClassNotFoundException: java\.lang\.invoke\.LambdaMetafactory|Exception in thread "main" java\.lang\.NullPointerException: Cannot read the array length because "urls" is null)/,
  },
  {
    key: "INSTALL_MIXINBOOTSTRAP",
    pattern:
      /java\.lang\.ClassNotFoundException: org\.spongepowered\.asm\.launch\.MixinTweaker/,
  },
  {
    key: "MOD_NAME",
    pattern: /Invalid module name: '' is not a Java identifier/,
  },
  {
    key: "INCOMPLETE_FORGE_INSTALLATION",
    pattern:
      /(java\.io\.UncheckedIOException: java\.io\.IOException: Invalid paths argument, contained no existing paths: \[(.*?)(forge\-(.*?)-client\.jar|fmlcore\-(.*?)\.jar)\]|Failed to find Minecraft resource version (.*?) at (.*?)forge\-(.*?)-client\.jar|Cannot find launch target fmlclient, unable to launch|java\.lang\.IllegalStateException: Could not find net\/minecraft\/client\/Minecraft\.class in classloader SecureModuleClassLoader)/,
  },
  {
    key: "NIGHT_CONFIG_FIXES",
    pattern:
      /com\.electronwill\.nightconfig\.core\.io\.ParsingException: Not enough data available/,
  },
  {
    key: "SHADERS_MOD",
    pattern:
      /java\.lang\.RuntimeException: Shaders Mod detected\. Please remove it, OptiFine has built-in support for shaders\./,
  },
  {
    key: "RTSS_FOREST_SODIUM",
    pattern:
      /RivaTuner Statistics Server \(RTSS\) is not compatible with Sodium/,
  },
  {
    key: "NATIVE_LIBRARY_ARCH_INCOMPATIBLE",
    pattern:
      /java\.lang\.UnsatisfiedLinkError: .*?\.(dylib|so|dll): dlopen\(.*?\): .*?missing compatible architecture.*?\(have '.*?', need '.*?'\)/,
  },
  {
    key: "MAC_DS_STORE",
    pattern:
      /ResourceLocationException: Non \[a-z0-9_.-\] character in namespace of location: \.DS_Store/,
  },
  {
    key: "LEVEL_DAT_CORRUPTED",
    pattern:
      /(Exception reading .*\\level\.dat|java\.util\.zip\.ZipException: invalid distance too far back|net\.minecraft\.util\.crash\.CrashException: Loading NBT data)/,
  },
  {
    key: "GL_OUT_OF_MEMORY",
    pattern:
      /GL_OUT_OF_MEMORY error generated\. Failed to allocate memory for buffer data\./,
  },
  {
    key: "MOD_JAVA_VERSION_MISMATCH",
    pattern:
      /(java\.lang\.UnsupportedClassVersionError: .*|Unsupported class file major version)/,
  },
  {
    key: "DUPLICATE_MOD_INSTALLED",
    pattern: /ModResolutionException: Duplicate/,
  },
  {
    key: "MOD_ZIP_CORRUPTED",
    pattern:
      /Caused by: java\.util\.zip\.ZipException: zip END header not found/,
  },
  {
    key: "MOD_INTERNET_ERROR",
    pattern: /(modpack-update-checker|commonality)/,
  },
  {
    key: "VICS_MODERN_WARFARE_ERROR",
    pattern: /java\.lang\.IllegalStateException: Not Building!/,
  },
  {
    key: "FORGE_LITELOADER_CONFLICT",
    pattern: /ModLauncher is not available/,
  },
];

export const analyzeCrashReport = (
  report: string[]
): { key: string; params: string[] } => {
  let reportText = report.join("\n");
  for (const rule of crashRules) {
    const match = rule.pattern.exec(reportText);
    if (match) {
      return {
        key: rule.key,
        params: match.slice(1),
      };
    }
  }
  return { key: "UNKNOWN", params: [] };
};
