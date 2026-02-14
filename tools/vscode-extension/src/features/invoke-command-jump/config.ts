export const INVOKE_COMMAND_JUMP_FEATURE_ID = "invoke-command-jump";

export const SUPPORTED_LANGUAGES = [
  "typescript",
  "typescriptreact",
  "javascript",
  "javascriptreact",
];

export const TAURI_SOURCE_GLOB = "src-tauri/src/**/*.rs";
export const TAURI_SOURCE_EXCLUDE_GLOB =
  "**/{target,node_modules,.git,out,dist,build}/**";
export const INVOKE_FUNCTION_NAMES = ["invoke"];

export const COMMAND_REBUILD_INVOKE_COMMAND_INDEX =
  "sjmclDevtools.invokeCommandJump.rebuildIndex";
