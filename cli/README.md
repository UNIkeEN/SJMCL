# SJMCL CLI

A command-line client for the SJMCL GUI app, connected through its MCP server.

## Build

From the repository root:

```bash
cargo build --release --manifest-path cli/Cargo.toml
```

The binary is `cli/target/release/sjmcl-cli` (`sjmcl-cli.exe` on Windows). The examples below assume it is on your `PATH`.

## Connect to the GUI app

Enable **Launcher MCP Service** in SJMCL's **Intelligence** settings. The CLI connects to `127.0.0.1:18970` by default. For a different port, place `-p <port>` before the command:

```bash
sjmcl-cli -p 18971 downloads
```

## Commands

### MCP Tools

MCP tools cover configuration, accounts, instances, launching, downloads, resources, etc.

Call a tool by name, with arguments as a single JSON object. When connected, `--help` lists available tools and their parameters; otherwise, it shows basic usage and connection hints.

```bash
sjmcl-cli --help
sjmcl-cli retrieve_launcher_config
sjmcl-cli retrieve_download_tasks '{"group_id":"<group-id>"}'
```

The CLI prints the tool response and returns. For tools that queue tasks, completion must be checked separately.

### Shortcuts

These commands wrap MCP tools with simpler arguments and formatted output. `install` and `download` wait for their task groups by default, show progress on stderr, and exit with status `1` on failure or cancellation. Add `--no-wait` to return after submission.

Installation waiting follows the `parentGroupId` relationships returned by the launcher, including child loader installation groups. A failed or cancelled child group also makes the command fail. The CLI requires a launcher that provides this relationship metadata.

#### Install an instance

Create a Minecraft instance in a configured game directory, optionally with a mod loader:

```bash
sjmcl-cli install 1.21.5 MyInstance
sjmcl-cli install 1.21.5 MyFabricInstance --directory Main --loader fabric
```

| Option                       | Description                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `--directory <name>`         | Game directory display name. Automatically selected when only one is configured; required otherwise. |
| `--loader <type>`            | Mod loader to install, such as `fabric`, `forge`, `neoforge`, or `quilt`.                            |
| `--loader-version <version>` | Exact loader version. Requires `--loader`.                                                           |
| `--optifine <patch>`         | OptiFine patch or filename to install.                                                               |

#### Download a file

Download an HTTP(S) URL to a destination file path:

```bash
sjmcl-cli download https://example.com/file.jar /path/to/file.jar
```

Use `--sha1 <hash>` to verify the file against an expected SHA-1 checksum.

#### List task groups

Show download and installation task groups:

```bash
sjmcl-cli downloads
```
