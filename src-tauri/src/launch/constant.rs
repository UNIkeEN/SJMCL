pub const GAME_PROCESS_OUTPUT_CHANNEL: &str = "launch://game-process-output";

pub const READY_FLAG: &[&str] = &[
  "Render thread",                            // 1.13+
  "Setting user:",                            // 1.12-
  "Forge Mod Loader has successfully loaded", // old forge
  "ModLauncher reached initialization",       // new forge
];
