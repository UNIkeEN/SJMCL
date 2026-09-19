fn main() {
  tauri_plugin::Builder::new(&[
    "submit_group",
    "pause_group",
    "resume_group",
    "cancel_group",
    "retry_group",
    "remove_group",
    "snapshot",
    "list_tasks",
  ])
  .build();
}
