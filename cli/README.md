# SJMCL CLI

A CLI for SJMCL that connects to the GUI app through its MCP server.

Build: 

```bash
cargo build --release --manifest-path cli/Cargo.toml
```

The launcher must have its MCP server enabled. Use `-p <port>` if it does not use the default port (18970).

Install a Minecraft version into an instance:

```bash
sjmcl-cli install 1.21.5 MyInstance
sjmcl-cli install 1.21.5 MyFabricInstance --directory Main --loader fabric
sjmcl-cli install 1.21.5 MyForgeInstance --loader forge
```

`install` waits for the client download, loader installation, and verification to finish. It exits with a nonzero status when a task group fails. If more than one game directory is configured, select one by its display name with `--directory`. Use `--loader-version` to select an exact loader version, `--optifine <patch>` to install OptiFine, or `--no-wait` to queue the work and return immediately.

Download a file through SJMCL's download engine:

```bash
sjmcl-cli download https://example.com/file.jar /path/to/file.jar
```

Use `--sha1` to verify the downloaded file against an expected checksum. In a terminal, both commands show live progress bars with transferred bytes and speed. When output is redirected, they print task state updates. `download` also accepts `--no-wait`.

Show current and past task groups:

```bash
sjmcl-cli downloads
```

The generic MCP tool command remains available. MCP clients can create instances with `create_instance`, submit files with `submit_download`, query `retrieve_download_groups`, `retrieve_download_progress`, and `retrieve_download_tasks`, and pause, resume, retry, cancel, or remove groups.
